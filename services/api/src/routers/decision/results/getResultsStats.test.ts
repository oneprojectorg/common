import { db } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('getResultsStats', () => {
  it('should return null when profile admin has access but no results exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toBeNull();
  });

  it('should return null when profile member has access but no results exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance, profileId } = setup.instances[0]!;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [profileId],
    });

    const caller = await createAuthenticatedCaller(memberUser.email);

    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toBeNull();
  });

  it('should allow org admin without profile access via org-level fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // grantAccess: false means the setup creator has no profile-level access,
    // but as the org creator they have the org Admin role which has decisions: READ
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toBeNull();
  });

  it('should allow org member without profile access via org-level fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance } = setup.instances[0]!;

    // Member has no profile-level access (instanceProfileIds: []),
    // but the org Member role has decisions: READ so the fallback should pass
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(memberUser.email);

    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toBeNull();
  });

  it('should allow user with profile access who is not in the organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance, profileId } = setup.instances[0]!;

    // Create a user in a different org, then grant them profile-level access
    // to the first setup's instance — they are NOT in setup's org
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    await testData.grantProfileAccess(
      profileId,
      otherSetup.user.id,
      otherSetup.userEmail,
      false,
    );

    const caller = await createAuthenticatedCaller(otherSetup.userEmail);

    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toBeNull();
  });

  it('should return stats when org member accesses instance with results', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { instance } = setup.instances[0]!;

    // Create a proposal so we can reference it in result selections
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Test Proposal' },
    });

    // Insert a successful result execution with 5 voters
    const [resultRecord] = await db
      .insert(decisionProcessResults)
      .values({
        processInstanceId: instance.id,
        success: true,
        voterCount: 5,
        selectedCount: 1,
      })
      .returning();

    // Insert a result selection with an allocated amount
    await db.insert(decisionProcessResultSelections).values({
      processResultId: resultRecord!.id,
      proposalId: proposal.id,
      allocated: '1000',
      selectionRank: 1,
    });

    // Create an org member (no profile access) — relies on org-level fallback
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(memberUser.email);

    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).not.toBeNull();
    expect(result!.membersVoted).toBe(5);
    expect(result!.proposalsFunded).toBe(1);
    expect(result!.totalAllocated).toBe(1000);
  });

  it('should throw UNAUTHORIZED when user is not in the organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance } = setup.instances[0]!;

    // Create a separate setup — this user belongs to a different organization
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      caller.decision.getResultsStats({ instanceId: instance.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should throw for non-existent instance ID', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getResultsStats({ instanceId: randomUUID() }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

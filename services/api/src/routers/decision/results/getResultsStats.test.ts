import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { createGatingCallers } from '../../../test/helpers/gating/callers';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
} from '../../../test/helpers/gating/decision';
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

/** Mints one successful result (5 voters) with a single selection allocated 1000. */
async function createResultWithOneSelection(
  testData: TestDecisionsDataManager,
  userEmail: string,
  instanceId: string,
) {
  const proposal = await testData.createProposal({
    userEmail,
    processInstanceId: instanceId,
    proposalData: { title: 'Test Proposal' },
  });

  const [resultRecord] = await db
    .insert(decisionProcessResults)
    .values({
      processInstanceId: instanceId,
      success: true,
      voterCount: 5,
      selectedCount: 1,
    })
    .returning();
  if (!resultRecord) {
    throw new Error('Failed to insert decision process result');
  }

  await db.insert(decisionProcessResultSelections).values({
    processResultId: resultRecord.id,
    proposalId: proposal.id,
    allocated: '1000',
    selectionRank: 1,
  });
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

    const { instance } = setup.instance;
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

    const { instance, profileId } = setup.instance;

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

    const { instance } = setup.instance;
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

    const { instance } = setup.instance;

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

    const { instance, profileId } = setup.instance;

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

    const { instance } = setup.instance;
    await createResultWithOneSelection(testData, setup.userEmail, instance.id);

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

    const { instance } = setup.instance;

    // Create a separate setup — this user belongs to a different organization
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      caller.decision.getResultsStats({ instanceId: instance.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('returns stats to a no-JWT visitor on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { instance, profileId } = setup.instance;
    await createResultWithOneSelection(testData, setup.userEmail, instance.id);

    await testData.makeDecisionPublic(profileId);

    const publicCaller = createCaller(await createTestContextWithSession(null));
    const result = await publicCaller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toEqual({
      membersVoted: 5,
      proposalsFunded: 1,
      totalAllocated: 1000,
    });
  });

  it('returns stats to an anonymous session on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { instance, profileId } = setup.instance;
    await createResultWithOneSelection(testData, setup.userEmail, instance.id);

    await testData.makeDecisionPublic(profileId);

    const caller = await createGatingCallers(onTestFinished).anonJwt();
    const result = await caller.decision.getResultsStats({
      instanceId: instance.id,
    });

    expect(result).toEqual({
      membersVoted: 5,
      proposalsFunded: 1,
      totalAllocated: 1000,
    });
  });

  it('does not serve cached stats to a no-JWT visitor on a non-public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { instance } = setup.instance;
    await createResultWithOneSelection(testData, setup.userEmail, instance.id);

    // A member read fills the per-instance stats cache first.
    const memberCaller = await createAuthenticatedCaller(setup.userEmail);
    const memberResult = await memberCaller.decision.getResultsStats({
      instanceId: instance.id,
    });
    expect(memberResult).not.toBeNull();

    const publicCaller = createCaller(await createTestContextWithSession(null));
    await expect(
      publicCaller.decision.getResultsStats({ instanceId: instance.id }),
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

describeDecisionAccessTierGating('getResultsStats', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate and denies them on a non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expect(
        caller.decision.getResultsStats({ instanceId: instance.instance.id }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate and denies them on a non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expect(
        caller.decision.getResultsStats({ instanceId: instance.instance.id }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate and denies them on a non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expect(
        caller.decision.getResultsStats({ instanceId: instance.instance.id }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.getResultsStats({
        instanceId: instance.instance.id,
      });
      expect(result).toBeNull();
    },
  ),
});

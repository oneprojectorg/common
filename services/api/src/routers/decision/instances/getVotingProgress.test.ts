import { mockCollab } from '@op/collab/testing';
import { invalidateDecisionInstance } from '@op/common';
import {
  TestDecisionsDataManager,
  testSimpleVotingSchema,
} from '@op/common/testing';
import { ProposalStatus, processInstances } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
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

async function setupVotingInstance(
  testData: TestDecisionsDataManager,
  { votingEndDate }: { votingEndDate?: string } = {},
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: testSimpleVotingSchema,
  });
  const instanceId = setup.instance.instance.id;

  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: instanceId,
    proposalData: { title: 'Community Garden' },
    status: ProposalStatus.SUBMITTED,
  });

  const { collaborationDocId } = proposal.proposalData as {
    collaborationDocId?: string;
  };
  if (collaborationDocId) {
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Community Garden',
    });
  }

  const [record] = await db
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));
  const instanceData = record?.instanceData as {
    phases: Array<{ phaseId: string }>;
  };

  await db
    .update(processInstances)
    .set({
      currentStateId: 'voting',
      instanceData: {
        ...instanceData,
        phases: instanceData.phases.map((phase) =>
          phase.phaseId === 'voting' ? { ...phase, endDate: votingEndDate } : phase,
        ),
      },
    })
    .where(eq(processInstances.id, instanceId));
  await invalidateDecisionInstance(instanceId);

  return { setup, instanceId, proposal };
}

describe.concurrent('getVotingProgress', () => {
  it('rejects a voting member who is not an admin of the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await setupVotingInstance(testData);

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.getVotingProgress({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an org admin with no grant on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await setupVotingInstance(testData);

    // `getInstance` resolves org roles only for an organization owner.
    await db
      .update(processInstances)
      .set({ ownerProfileId: setup.organization.profileId })
      .where(eq(processInstances.id, instanceId));
    await invalidateDecisionInstance(instanceId);

    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
      orgRoleId: ROLES.ADMIN.id,
    });
    const orgAdminCaller = await createAuthenticatedCaller(orgAdmin.email);

    await expect(
      orgAdminCaller.decision.getVotingProgress({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('counts votes from eligible members against every member who can vote', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, proposal } = await setupVotingInstance(
      testData,
      {
        votingEndDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      },
    );
    const instanceProfileId = setup.instance.profileId;

    const [voter] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instanceProfileId],
      }),
    ]);

    // An organization member without access to the decision cannot vote.
    await testData.createMemberUser({ organization: setup.organization });

    const voterCaller = await createAuthenticatedCaller(voter.email);
    await voterCaller.decision.submitVote({
      processInstanceId: instanceId,
      selectedProposalIds: [proposal.id],
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.getVotingProgress({
      processInstanceId: instanceId,
    });

    // Eligible: the admin, the voter and the member who did not vote.
    expect(result).toEqual({
      participantsVotedCount: 1,
      participantsEligibleCount: 3,
      turnoutPercentage: 33,
      daysLeft: 10,
    });
  });

  it('returns zero turnout and null daysLeft before anyone votes in a phase with no end date', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await setupVotingInstance(testData);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.getVotingProgress({
      processInstanceId: instanceId,
    });

    expect(result).toEqual({
      participantsVotedCount: 0,
      participantsEligibleCount: 1,
      turnoutPercentage: 0,
      daysLeft: null,
    });
  });
});

describeDecisionAccessTierGating('getVotingProgress', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instanceId } = await setupVotingInstance(testData);

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getVotingProgress({ processInstanceId: instanceId }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instanceId } = await setupVotingInstance(testData);

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getVotingProgress({ processInstanceId: instanceId }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instanceId } = await setupVotingInstance(testData);

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getVotingProgress({ processInstanceId: instanceId }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT admin on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instanceId } = await setupVotingInstance(testData);

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.getVotingProgress({ processInstanceId: instanceId }),
      );
    },
  ),
});

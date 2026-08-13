import {
  ProposalStatus,
  authUsers,
  processInstances,
  profiles,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

function buildVotingSchema() {
  return {
    id: 'voting-listVoters-test',
    version: '1.0.0',
    name: 'List Voters Test Schema',
    description: 'Schema for listVoters integration tests',
    phases: [
      {
        id: 'submission',
        name: 'Submission',
        rules: {
          proposals: { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'voting',
        name: 'Voting',
        rules: {
          proposals: { submit: false },
          voting: { submit: true },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'results',
        name: 'Results',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
    ],
  };
}

async function setupVotingInstance(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: buildVotingSchema(),
  });

  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }

  const proposals = await Promise.all(
    Array.from({ length: 3 }, (_, i) =>
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Proposal ${i + 1}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ),
  );

  await db
    .update(processInstances)
    .set({ currentStateId: 'voting' })
    .where(eq(processInstances.id, instance.instance.id));

  return { setup, instance, proposals };
}

describe.concurrent('listVoters', () => {
  it('returns profiles of users who submitted a vote', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const voter = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });
    const voterCaller = await createAuthenticatedCaller(voter.email);

    await voterCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    const result = await adminCaller.decision.listVoters({
      processInstanceId: instance.instance.id,
    });

    expect(result.voters).toHaveLength(1);
    expect(result.voters[0]?.slug).toBeDefined();
    expect(result.total).toBe(1);
  });

  it('excludes members who never voted', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });

    const result = await adminCaller.decision.listVoters({
      processInstanceId: instance.instance.id,
    });

    expect(result.voters).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns multiple distinct voters', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const voterA = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });
    const voterB = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });

    const callerA = await createAuthenticatedCaller(voterA.email);
    const callerB = await createAuthenticatedCaller(voterB.email);

    await callerA.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });
    await callerB.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[1]!.id],
    });

    const result = await adminCaller.decision.listVoters({
      processInstanceId: instance.instance.id,
    });

    expect(result.voters).toHaveLength(2);
    const slugs = new Set(result.voters.map((voter) => voter.slug));
    expect(slugs.size).toBe(2);
    expect(result.total).toBe(2);
  });

  it('excludes anonymous voters from both the list and the total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const namedVoter = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });
    const anonVoter = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });

    const namedCaller = await createAuthenticatedCaller(namedVoter.email);
    const anonCaller = await createAuthenticatedCaller(anonVoter.email);

    await namedCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });
    await anonCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[1]!.id],
    });

    // Flip the second voter's auth user to anonymous after voting; both votes
    // are already recorded, so only the filter can tell them apart.
    await db
      .update(authUsers)
      .set({ isAnonymous: true })
      .where(eq(authUsers.id, anonVoter.authUserId));

    const result = await adminCaller.decision.listVoters({
      processInstanceId: instance.instance.id,
    });

    const [namedProfile] = await db
      .select({ slug: profiles.slug })
      .from(profiles)
      .where(eq(profiles.id, namedVoter.profileId));

    expect(result.voters).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.voters[0]?.slug).toBe(namedProfile?.slug);
  });

  it('allows an org admin who lacks profile-level access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData);

    const voter = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });
    const voterCaller = await createAuthenticatedCaller(voter.email);

    await voterCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    // An org admin who did NOT create the instance, so they get no profile
    // grant on it (the creator is auto-added as a profile admin, which is why
    // `grantAccess: false` alone wouldn't exercise this). Only the org-level
    // fallback can admit them.
    const orgAdmin = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      orgRoleId: ROLES.ADMIN.id,
    });
    const orgAdminCaller = await createAuthenticatedCaller(orgAdmin.email);

    const result = await orgAdminCaller.decision.listVoters({
      processInstanceId: instance.instance.id,
    });

    expect(result.voters).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('denies rather than errors on a legacy instance with no profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData);

    // `processInstances.profileId` is still nullable for processes that predate
    // the per-instance profile. Those must deny like any other inaccessible
    // process instead of surfacing an internal error to the caller.
    await db
      .update(processInstances)
      .set({ profileId: null })
      .where(eq(processInstances.id, instance.instance.id));

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.decision.listVoters({
        processInstanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects non-admin callers', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData);

    const voter = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [instance.profileId],
    });
    const voterCaller = await createAuthenticatedCaller(voter.email);

    await voterCaller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: [proposals[0]!.id],
    });

    await expect(
      voterCaller.decision.listVoters({
        processInstanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

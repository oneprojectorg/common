import { createDecisionRole } from '@op/common';
import { db, eq } from '@op/db/client';
import { ProcessStatus, ProposalStatus, processInstances } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const gatingInput = {
  instanceId: crypto.randomUUID(),
  phaseId: 'initial',
  reviewerProfileId: crypto.randomUUID(),
  proposalIds: [crypto.randomUUID()],
};

describeAccessTierGating('platform.admin.assignReviews', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.assignReviews(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.assignReviews(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(
        caller.platform.admin.assignReviews(gatingInput),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.assignReviews(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.assignReviews', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  const createSetupWithProposal = async (
    taskId: string,
    onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
  ) => {
    const testData = new TestDecisionsDataManager(taskId, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${taskId}` },
      status: ProposalStatus.SUBMITTED,
    });

    const phaseId = setup.instance.instance.currentStateId ?? 'initial';
    const decisionProfileId = setup.instance.profileId;

    // Eligible reviewer: decision-profile member holding a role with the
    // REVIEW capability. (The setup user acts as the org profile when
    // creating the proposal, so the org profile is the author.)
    const reviewerRole = await createDecisionRole({
      name: 'Reviewer',
      profileId: decisionProfileId,
      permissions: {
        decisions: {
          type: 'decision',
          value: {
            create: false,
            read: true,
            update: false,
            delete: false,
            admin: false,
            inviteMembers: false,
            review: true,
            submitProposals: true,
            vote: false,
          },
        },
      },
    });
    const reviewer = await testData.createMemberUser({
      organization: { id: setup.organization.id },
      instanceProfileIds: [decisionProfileId],
      roleIds: { [decisionProfileId]: reviewerRole.id },
    });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    return { setup, testData, instanceId, proposal, phaseId, caller, reviewer };
  };

  it('creates assignments, is idempotent, and shows up in the listing', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, phaseId, caller, reviewer } =
      await createSetupWithProposal(task.id, onTestFinished);

    const reviewerProfileId = reviewer.profileId;

    const first = await caller.assignReviews({
      instanceId,
      phaseId,
      reviewerProfileId,
      proposalIds: [proposal.id],
    });
    expect(first.createdCount).toBe(1);

    // Re-running does not duplicate assignments.
    const second = await caller.assignReviews({
      instanceId,
      phaseId,
      reviewerProfileId,
      proposalIds: [proposal.id],
    });
    expect(second.createdCount).toBe(0);

    const listing = await caller.listDecisionReviewAssignments({
      instanceId,
      phaseId,
    });

    expect(listing.totalAssignments).toBe(1);
    expect(listing.reviewers).toHaveLength(1);
    const rollup = listing.reviewers[0]!;
    expect(rollup.profile.id).toBe(reviewerProfileId);
    expect(rollup.assignedCount).toBe(1);
    expect(rollup.submittedCount).toBe(0);
    expect(rollup.assignments[0]?.proposalId).toBe(proposal.id);

    // Dialog candidates come back too.
    expect(listing.proposals.map((p) => p.id)).toContain(proposal.id);
  });

  it('never assigns a reviewer their own proposal', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, phaseId, caller, reviewer } =
      await createSetupWithProposal(task.id, onTestFinished);

    // The reviewer authors a proposal of their own.
    const ownProposal = await testData.createProposal({
      userEmail: reviewer.email,
      processInstanceId: instanceId,
      proposalData: { title: `Own proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    const result = await caller.assignReviews({
      instanceId,
      phaseId,
      reviewerProfileId: reviewer.profileId,
      proposalIds: [ownProposal.id],
    });

    expect(result.createdCount).toBe(0);
  });

  it('rejects a reviewer without the REVIEW capability', async ({
    task,
    onTestFinished,
  }) => {
    const { setup, instanceId, proposal, phaseId, caller } =
      await createSetupWithProposal(task.id, onTestFinished);

    await expect(() =>
      caller.assignReviews({
        instanceId,
        phaseId,
        // The org profile is not a decision member with REVIEW.
        reviewerProfileId: setup.organization.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('rejects assignment into a completed phase', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, phaseId, caller, reviewer } =
      await createSetupWithProposal(task.id, onTestFinished);

    // Advance the instance past the target phase so it counts as completed.
    await db
      .update(processInstances)
      .set({ currentStateId: 'final' })
      .where(eq(processInstances.id, instanceId));

    await expect(() =>
      caller.assignReviews({
        instanceId,
        phaseId,
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('throws for proposals outside the instance', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, phaseId, caller, reviewer } =
      await createSetupWithProposal(task.id, onTestFinished);

    await expect(() =>
      caller.assignReviews({
        instanceId,
        phaseId,
        reviewerProfileId: reviewer.profileId,
        proposalIds: [crypto.randomUUID()],
      }),
    ).rejects.toThrow();
  });
});

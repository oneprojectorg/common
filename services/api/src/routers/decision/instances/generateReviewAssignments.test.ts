import {
  type DecisionInstanceData,
  type DecisionSchemaDefinition,
  type ReviewsPolicy,
  advancePhase,
  createDecisionRole,
  generateReviewAssignments,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  proposalReviewAssignments,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';

/**
 * Schema with a review-capable middle phase.
 * submission → review (proposals.review: true) → results
 */
const decisionSchemaWithReview = {
  id: 'review-test-schema',
  version: '1.0.0',
  name: 'Review Test Schema',
  description: 'Schema with a review phase for testing',
  config: {
    reviewsPolicy: 'full_coverage' as const,
  },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      description: 'Submit proposals',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' as const },
      },
      // Pass-all: every submitted proposal advances into review so the
      // assignment generator has proposals to fan out to reviewers.
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review proposals',
      rules: {
        proposals: { review: true },
        advancement: { method: 'manual' as const },
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'Final results',
      rules: {
        proposals: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * Creates a published decision instance from the review schema.
 * Returns the instance, its profileId, and the creating user's personal profileId.
 */
async function createReviewInstance(
  testData: TestDecisionsDataManager,
  { reviewsPolicy = 'full_coverage' }: { reviewsPolicy?: ReviewsPolicy } = {},
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: {
      ...decisionSchemaWithReview,
      config: { ...decisionSchemaWithReview.config, reviewsPolicy },
    },
    status: ProcessStatus.PUBLISHED,
  });

  const [userRecord] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, setup.user.id));

  return {
    setup,
    instance: setup.instance,
    creatorProfileId: userRecord!.profileId!,
  };
}

/**
 * Creates a "Reviewer" role on the given decision profile with the REVIEW bit set.
 */
async function createReviewerRole(instanceProfileId: string) {
  return createDecisionRole({
    name: 'Reviewer',
    profileId: instanceProfileId,
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
          submitProposals: false,
          vote: false,
        },
      },
    },
  });
}

/**
 * Advances the instance from submission → review via advancePhase inside a
 * transaction and returns the non-conflict result.
 */
async function advanceToReviewPhase(instanceId: string) {
  const dbInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!dbInstance) {
    throw new Error('Instance not found');
  }

  const result = await db.transaction(async (tx) =>
    advancePhase({
      db: tx,
      instance: {
        id: dbInstance.id,
        instanceData: dbInstance.instanceData as DecisionInstanceData,
      },
      fromPhaseId: 'submission',
      toPhaseId: 'review',
      triggeredByProfileId: null,
    }),
  );

  if (result.conflict) {
    throw new Error('Unexpected conflict during advance');
  }

  return result;
}

describe.concurrent('generateReviewAssignments', () => {
  it('full_coverage assigns only members with REVIEW capability, excluding self-review', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, creatorProfileId } =
      await createReviewInstance(testData);

    const reviewerRole = await createReviewerRole(instance.profileId);

    // Create 3 members: reviewerA, reviewerB (both with REVIEW), memberC (no REVIEW)
    const [reviewerA, reviewerB, memberC] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    // Create submitted proposals (DB trigger creates history rows on status change)
    const [proposalByA, proposalByC] = await Promise.all([
      testData.createProposal({
        userEmail: reviewerA.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal by Reviewer A' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: memberC.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal by Member C' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Advance submission → review to get transitionHistoryId + transition proposal rows
    const advanceResult = await advanceToReviewPhase(instance.instance.id);

    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const assignments = await db
      .select()
      .from(proposalReviewAssignments)
      .where(
        eq(proposalReviewAssignments.processInstanceId, instance.instance.id),
      );

    const assignmentsByReviewer = new Map<string, string[]>();
    for (const a of assignments) {
      const existing = assignmentsByReviewer.get(a.reviewerProfileId) ?? [];
      existing.push(a.proposalId);
      assignmentsByReviewer.set(a.reviewerProfileId, existing);
    }

    // Exact set of reviewers who should appear — and no one else.
    // reviewerA and reviewerB have REVIEW via the custom Reviewer role.
    // memberC has only the Member role (no REVIEW) — must be absent.
    // creatorAdmin holds the seeded Admin role, which does NOT carry REVIEW —
    // administering a process does not make you one of its reviewers.
    const expectedReviewerIds = new Set([
      reviewerA.profileId,
      reviewerB.profileId,
    ]);
    const excludedProfileIds = [memberC.profileId, creatorProfileId];

    const actualReviewerIds = new Set(assignmentsByReviewer.keys());
    expect(actualReviewerIds).toEqual(expectedReviewerIds);

    for (const excluded of excludedProfileIds) {
      expect(assignmentsByReviewer.has(excluded)).toBe(false);
    }

    // Per-reviewer assignment breakdown:
    // reviewerA: only proposalByC (self-review excluded for proposalByA)
    expect(assignmentsByReviewer.get(reviewerA.profileId)).toEqual([
      proposalByC.id,
    ]);

    // reviewerB: both proposals
    expect(assignmentsByReviewer.get(reviewerB.profileId)).toHaveLength(2);
    expect(assignmentsByReviewer.get(reviewerB.profileId)).toEqual(
      expect.arrayContaining([proposalByA.id, proposalByC.id]),
    );

    expect(assignments).toHaveLength(3);

    // Every assignment should have a pinned proposal history snapshot
    for (const a of assignments) {
      expect(a.assignedProposalHistoryId).not.toBeNull();
    }
  });

  it('does nothing when selectedProposalIds is empty', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createReviewInstance(testData);

    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: [],
      transitionHistoryId: 'irrelevant',
    });

    const assignments = await db
      .select()
      .from(proposalReviewAssignments)
      .where(
        eq(proposalReviewAssignments.processInstanceId, instance.instance.id),
      );

    expect(assignments).toHaveLength(0);
  });

  it("policy 'none' writes nothing", async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData, {
      reviewsPolicy: 'none',
    });

    // A reviewer who is not the author, so full_coverage would write one
    // assignment here — policy 'none' has to be the only reason nothing is
    // written, otherwise an empty result proves nothing.
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [, author] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal under policy none' },
      status: ProposalStatus.SUBMITTED,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    // Guard against a vacuous pass: the empty-selection early return sits above
    // the policy check, so the proposal has to actually reach the review phase.
    expect(advanceResult.selectedProposalIds).toHaveLength(1);

    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const assignments = await db
      .select()
      .from(proposalReviewAssignments)
      .where(
        eq(proposalReviewAssignments.processInstanceId, instance.instance.id),
      );

    expect(assignments).toEqual([]);
  });

  it('is idempotent — calling twice does not duplicate rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData);

    const reviewerRole = await createReviewerRole(instance.profileId);
    await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Idempotency proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);

    const input = {
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    };

    await generateReviewAssignments(input);
    await generateReviewAssignments(input);

    const assignments = await db
      .select()
      .from(proposalReviewAssignments)
      .where(
        eq(proposalReviewAssignments.processInstanceId, instance.instance.id),
      );

    // Each reviewer should appear exactly once per proposal, not duplicated.
    const uniquePairs = new Set(
      assignments.map((a) => `${a.reviewerProfileId}:${a.proposalId}`),
    );
    expect(assignments).toHaveLength(uniquePairs.size);
  });
});

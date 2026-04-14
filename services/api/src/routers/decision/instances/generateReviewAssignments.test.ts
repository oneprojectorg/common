import {
  type DecisionInstanceData,
  type DecisionSchemaDefinition,
  advancePhase,
  createDecisionRole,
  generateReviewAssignments,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  processInstances,
  proposalReviewAssignments,
  users,
} from '@op/db/schema';
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
async function createReviewInstance(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: decisionSchemaWithReview,
    status: ProcessStatus.PUBLISHED,
  });

  const [userRecord] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, setup.user.id));

  return {
    setup,
    instance: setup.instances[0]!,
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
      tx,
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

/** Patches the reviewsPolicy on an existing instance's instanceData. */
async function setReviewsPolicy(instanceId: string, reviewsPolicy: string) {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });
  const instanceData = instance!.instanceData as Record<string, unknown>;
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        config: { ...(instanceData.config as object), reviewsPolicy },
      },
    })
    .where(eq(processInstances.id, instanceId));
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
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    // Give reviewerA and reviewerB the Reviewer role
    await Promise.all([
      testData.assignRole(
        reviewerA.authUserId,
        instance.profileId,
        reviewerRole.id,
      ),
      testData.assignRole(
        reviewerB.authUserId,
        instance.profileId,
        reviewerRole.id,
      ),
    ]);

    // Create and submit proposals so they have history rows
    const [proposalByA, proposalByC] = await Promise.all([
      testData.createProposal({
        userEmail: reviewerA.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal by Reviewer A' },
      }),
      testData.createProposal({
        userEmail: memberC.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal by Member C' },
      }),
    ]);

    const [callerA, callerC] = await Promise.all([
      createAuthenticatedCaller(reviewerA.email),
      createAuthenticatedCaller(memberC.email),
    ]);

    await Promise.all([
      callerA.decision.submitProposal({ proposalId: proposalByA.id }),
      callerC.decision.submitProposal({ proposalId: proposalByC.id }),
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
    // creatorAdmin has REVIEW via createDefaultDecisionRoles.
    // reviewerA and reviewerB have REVIEW via the custom Reviewer role.
    // memberC has only the Member role (no REVIEW) — must be absent.
    const expectedReviewerIds = new Set([
      creatorProfileId,
      reviewerA.profileId,
      reviewerB.profileId,
    ]);
    const excludedProfileIds = [memberC.profileId];

    const actualReviewerIds = new Set(assignmentsByReviewer.keys());
    expect(actualReviewerIds).toEqual(expectedReviewerIds);

    for (const excluded of excludedProfileIds) {
      expect(assignmentsByReviewer.has(excluded)).toBe(false);
    }

    // Per-reviewer assignment breakdown:
    // creatorAdmin: both proposals (authored neither)
    expect(assignmentsByReviewer.get(creatorProfileId)).toHaveLength(2);
    expect(assignmentsByReviewer.get(creatorProfileId)).toEqual(
      expect.arrayContaining([proposalByA.id, proposalByC.id]),
    );

    // reviewerA: only proposalByC (self-review excluded for proposalByA)
    expect(assignmentsByReviewer.get(reviewerA.profileId)).toEqual([
      proposalByC.id,
    ]);

    // reviewerB: both proposals
    expect(assignmentsByReviewer.get(reviewerB.profileId)).toHaveLength(2);
    expect(assignmentsByReviewer.get(reviewerB.profileId)).toEqual(
      expect.arrayContaining([proposalByA.id, proposalByC.id]),
    );

    expect(assignments).toHaveLength(5);

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

  it('throws for self_selection policy', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createReviewInstance(testData);

    await setReviewsPolicy(instance.instance.id, 'self_selection');

    await expect(
      generateReviewAssignments({
        instanceId: instance.instance.id,
        phaseId: 'review',
        selectedProposalIds: ['any-id'],
        transitionHistoryId: 'irrelevant',
      }),
    ).rejects.toThrow('not implemented');
  });

  it('is idempotent — calling twice does not duplicate rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData);

    const reviewerRole = await createReviewerRole(instance.profileId);
    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await testData.assignRole(
      reviewer.authUserId,
      instance.profileId,
      reviewerRole.id,
    );

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Idempotency proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitProposal({ proposalId: proposal.id });

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

  it('throws for random_assignment policy', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createReviewInstance(testData);

    await setReviewsPolicy(instance.instance.id, 'random_assignment');

    await expect(
      generateReviewAssignments({
        instanceId: instance.instance.id,
        phaseId: 'review',
        selectedProposalIds: ['any-id'],
        transitionHistoryId: 'irrelevant',
      }),
    ).rejects.toThrow('not implemented');
  });
});

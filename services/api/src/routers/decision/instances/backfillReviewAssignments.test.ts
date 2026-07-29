import {
  type DecisionInstanceData,
  type DecisionSchemaDefinition,
  type ReviewsPolicy,
  advancePhase,
  backfillReviewAssignments,
  createDecisionRole,
  generateReviewAssignments,
  updateProfileUserRoles,
} from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { event } from '@op/events';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
import { createIsolatedSession } from '../../../test/supabase-utils';

vi.mock('@op/events', async () => {
  const actual = await vi.importActual('@op/events');
  return {
    ...actual,
    event: {
      send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }),
    },
  };
});

/**
 * Schema with a review-capable middle phase that also accepts submissions,
 * so tests can create mid-phase proposals (the ones backfill must NOT assign).
 * submission → review (proposals.review + submit) → results
 */
const decisionSchemaWithReview = {
  id: 'backfill-test-schema',
  version: '1.0.0',
  name: 'Backfill Test Schema',
  description: 'Schema with a review phase for backfill testing',
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
      // Pass-all: every submitted proposal advances into review.
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'review',
      name: 'Review',
      description: 'Review proposals',
      rules: {
        proposals: { review: true, submit: true },
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

/** Schema whose FIRST phase is review-capable — no inbound transition exists. */
const decisionSchemaReviewFirst = {
  ...decisionSchemaWithReview,
  id: 'backfill-review-first-schema',
  name: 'Backfill Review-First Schema',
  phases: [
    decisionSchemaWithReview.phases[1],
    decisionSchemaWithReview.phases[2],
  ],
} satisfies DecisionSchemaDefinition;

/** The schema shape createDecisionSetup accepts (encoder-inferred, not exported). */
type TestProcessSchema = NonNullable<
  NonNullable<
    Parameters<TestDecisionsDataManager['createDecisionSetup']>[0]
  >['processSchema']
>;

async function createReviewInstance(
  testData: TestDecisionsDataManager,
  {
    reviewsPolicy = 'full_coverage',
    processSchema = decisionSchemaWithReview,
  }: {
    reviewsPolicy?: ReviewsPolicy;
    processSchema?: TestProcessSchema;
  } = {},
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: {
      ...processSchema,
      config: { ...processSchema.config, reviewsPolicy },
    },
    status: ProcessStatus.PUBLISHED,
  });

  return { setup, instance: setup.instance };
}

/** Creates a "Reviewer" role on the given decision profile with the REVIEW bit set. */
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
 * Advances the instance submission → review and runs the original assignment
 * generation, mirroring what onPhaseAdvanced does at a real phase transition.
 */
async function advanceToReviewAndGenerate(instanceId: string) {
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

  await generateReviewAssignments({
    instanceId,
    phaseId: 'review',
    selectedProposalIds: result.selectedProposalIds,
    transitionHistoryId: result.transitionHistoryId,
  });

  return result;
}

async function getAssignments(instanceId: string) {
  return db
    .select()
    .from(proposalReviewAssignments)
    .where(eq(proposalReviewAssignments.processInstanceId, instanceId));
}

describe.concurrent('backfillReviewAssignments', () => {
  it('backfills a mid-phase reviewer to parity with the original generation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData);
    const reviewerRole = await createReviewerRole(instance.profileId);

    // reviewerA reviews from the start; lateReviewer joins mid-phase.
    const [reviewerA, lateReviewer] = await Promise.all([
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

    const [proposalByA, proposalByLate] = await Promise.all([
      testData.createProposal({
        userEmail: reviewerA.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal by Reviewer A' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: lateReviewer.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal by Late Reviewer' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await advanceToReviewAndGenerate(instance.instance.id);
    const assignmentsAfterGeneration = await getAssignments(
      instance.instance.id,
    );

    // Submitted DURING the review phase: existing reviewers were never
    // assigned it, so the backfilled reviewer must not be either.
    const midPhaseProposal = await testData.createProposal({
      userEmail: reviewerA.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Mid-phase proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    // The mid-phase role grant this feature exists for.
    await testData.assignRole(
      lateReviewer.authUserId,
      instance.profileId,
      reviewerRole.id,
    );

    const result = await backfillReviewAssignments({
      instanceId: instance.instance.id,
      reviewerProfileIds: [lateReviewer.profileId],
    });

    // Only proposalByA: own proposal excluded, mid-phase proposal excluded.
    expect(result).toEqual({
      inserted: 1,
      reviewerCount: 1,
      proposalCount: 2,
    });

    const assignments = await getAssignments(instance.instance.id);
    const lateAssignments = assignments.filter(
      (a) => a.reviewerProfileId === lateReviewer.profileId,
    );
    expect(lateAssignments).toHaveLength(1);
    expect(lateAssignments[0]?.proposalId).toBe(proposalByA.id);
    expect(lateAssignments[0]?.phaseId).toBe('review');

    // Self-review exclusion: their own proposal was in the attachment set but
    // must not have been assigned to them.
    expect(
      assignments.filter(
        (a) =>
          a.proposalId === proposalByLate.id &&
          a.reviewerProfileId === lateReviewer.profileId,
      ),
    ).toHaveLength(0);

    // Snapshot parity: the backfilled row pins the same proposal history
    // captured at the transition as existing reviewers' rows.
    const existingRowForSameProposal = assignmentsAfterGeneration.find(
      (a) =>
        a.proposalId === proposalByA.id &&
        a.reviewerProfileId !== lateReviewer.profileId,
    );
    expect(
      existingRowForSameProposal?.assignedProposalHistoryId,
    ).not.toBeNull();
    expect(lateAssignments[0]?.assignedProposalHistoryId).toBe(
      existingRowForSameProposal?.assignedProposalHistoryId,
    );

    // Nobody was assigned the mid-phase proposal, and pre-existing rows are
    // untouched (add-only).
    expect(
      assignments.filter((a) => a.proposalId === midPhaseProposal.id),
    ).toHaveLength(0);
    expect(assignments).toHaveLength(assignmentsAfterGeneration.length + 1);
  });

  it('re-checks eligibility and converges across re-runs', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData);
    const reviewerRole = await createReviewerRole(instance.profileId);

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Creator proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await advanceToReviewAndGenerate(instance.instance.id);
    const assignmentsAfterGeneration = await getAssignments(
      instance.instance.id,
    );

    // Not a reviewer yet: the narrowing hint must not bypass eligibility.
    const beforeGrant = await backfillReviewAssignments({
      instanceId: instance.instance.id,
      reviewerProfileIds: [member.profileId],
    });
    expect(beforeGrant).toEqual({
      inserted: 0,
      reviewerCount: 0,
      proposalCount: 1,
    });

    await testData.assignRole(
      member.authUserId,
      instance.profileId,
      reviewerRole.id,
    );

    const afterGrant = await backfillReviewAssignments({
      instanceId: instance.instance.id,
      reviewerProfileIds: [member.profileId],
    });
    expect(afterGrant).toEqual({
      inserted: 1,
      reviewerCount: 1,
      proposalCount: 1,
    });

    // Idempotent re-run (narrowed) and a full un-narrowed pass both converge
    // without inserting anything new.
    const rerun = await backfillReviewAssignments({
      instanceId: instance.instance.id,
      reviewerProfileIds: [member.profileId],
    });
    const unNarrowed = await backfillReviewAssignments({
      instanceId: instance.instance.id,
    });
    expect(rerun).toMatchObject({ inserted: 0 });
    expect(unNarrowed).toMatchObject({ inserted: 0 });

    // Exactly one row was added across all four runs, and it's the member's.
    const assignments = await getAssignments(instance.instance.id);
    expect(assignments).toHaveLength(assignmentsAfterGeneration.length + 1);
    expect(
      assignments.filter((a) => a.reviewerProfileId === member.profileId),
    ).toHaveLength(1);
  });

  it('no-ops (never throws) for missing, unpublished, or non-review-phase instances', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData);

    // Published, but still in the submission phase.
    await expect(
      backfillReviewAssignments({ instanceId: instance.instance.id }),
    ).resolves.toEqual({
      skipped: 'current phase is not review-capable',
    });

    // Draft sibling instance on the same process.
    const draftInstance = await testData.createInstanceForProcess({
      processId: setup.process.id,
      user: setup.user,
      name: 'Draft instance',
    });
    await expect(
      backfillReviewAssignments({ instanceId: draftInstance.instance.id }),
    ).resolves.toEqual({
      skipped: expect.stringContaining('not published'),
    });

    await expect(
      backfillReviewAssignments({ instanceId: randomUUID() }),
    ).resolves.toEqual({ skipped: 'instance not found' });

    expect(await getAssignments(instance.instance.id)).toHaveLength(0);
  });

  it('no-ops when the review phase is the initial phase (no inbound transition)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createReviewInstance(testData, {
      processSchema: decisionSchemaReviewFirst,
    });

    // Generation never ran for this phase either — nothing to reach parity
    // with, so the backfill must decline rather than invent assignments.
    await expect(
      backfillReviewAssignments({ instanceId: instance.instance.id }),
    ).resolves.toEqual({
      skipped: 'current phase has no inbound transition',
    });
  });
});

describe.concurrent('decision/member-roles-changed emission', () => {
  it('emits for decision-profile role changes only, and only when roles actually change', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData);
    const reviewerRole = await createReviewerRole(instance.profileId);

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const decisionProfileUser = await db.query.profileUsers.findFirst({
      where: {
        profileId: instance.profileId,
        authUserId: member.authUserId,
      },
      with: { roles: true },
    });
    if (!decisionProfileUser) {
      throw new Error('Expected decision profileUser for member');
    }
    const existingRoleIds = decisionProfileUser.roles.map(
      (r) => r.accessRoleId,
    );

    // Role change on a decision profile → emits with the exact delta.
    await updateProfileUserRoles({
      profileUserId: decisionProfileUser.id,
      roleIds: [...existingRoleIds, reviewerRole.id],
      user: setup.user,
    });

    expect(event.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'decision/member-roles-changed',
        data: {
          decisionProfileId: instance.profileId,
          authUserId: member.authUserId,
          addedRoleIds: [reviewerRole.id],
          removedRoleIds: [],
        },
      }),
    );

    // Same roles again → no change → no event (an empty-delta emission
    // would show up as added/removed both []).
    await updateProfileUserRoles({
      profileUserId: decisionProfileUser.id,
      roleIds: [...existingRoleIds, reviewerRole.id],
      user: setup.user,
    });

    expect(event.send).not.toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'decision/member-roles-changed',
        data: expect.objectContaining({
          decisionProfileId: instance.profileId,
          addedRoleIds: [],
          removedRoleIds: [],
        }),
      }),
    );

    // Role change on an ORG-type profile → not a decision profile → no event.
    const orgTestData = new TestProfileUserDataManager(task.id, onTestFinished);
    const {
      profile: orgProfile,
      adminUser,
      memberUsers,
    } = await orgTestData.createProfile({
      users: { admin: 1, member: 1 },
    });
    const orgMember = memberUsers[0];
    if (!orgMember) {
      throw new Error('Expected org member to be defined');
    }
    const { session } = await createIsolatedSession(adminUser.email);

    await updateProfileUserRoles({
      profileUserId: orgMember.profileUserId,
      roleIds: [ROLES.MEMBER.id, ROLES.ADMIN.id],
      user: session.user,
    });

    expect(event.send).not.toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'decision/member-roles-changed',
        data: expect.objectContaining({
          decisionProfileId: orgProfile.id,
        }),
      }),
    );
  });
});

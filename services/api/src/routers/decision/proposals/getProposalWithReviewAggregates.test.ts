import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import { OVERALL_RECOMMENDATION_KEY } from '@op/common/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  processInstances,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview, createReviewAssignment } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['impact', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      minimum: 0,
      maximum: 10,
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      minimum: 1,
      maximum: 5,
    },
    [OVERALL_RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function advanceToReviewPhase(instanceId: string) {
  await db
    .update(processInstances)
    .set({ currentStateId: 'review' })
    .where(eq(processInstances.id, instanceId));
}

// --- Two back-to-back review phases (Columbus: feasibility → community) ----

const FEASIBILITY_PHASE = 'feasibility';
const COMMUNITY_PHASE = 'community';

const twoReviewPhaseSchema = {
  id: 'two-review-phases',
  version: '1.0.0',
  name: 'Two Review Phases',
  description: 'Feasibility review followed by a community impact review.',
  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-01' },
      },
    },
    {
      id: FEASIBILITY_PHASE,
      name: 'Feasibility Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-02' },
      },
    },
    {
      id: COMMUNITY_PHASE,
      name: 'Community Impact Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-03' },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * One proposal with a submitted review pinned to each of the two review
 * phases; the instance ends up sitting in the community phase. `openReviews`
 * is left unset (off) on both phases — tests flip it per scenario.
 */
async function seedTwoPhaseReviews(testData: TestReviewsDataManager) {
  const context = await testData.createContext({
    processSchema: twoReviewPhaseSchema,
  });
  await testData.setRubricTemplate(context, rubricTemplate);

  const feasibilityScenario = await testData.createReviewAssignment({
    context,
    title: 'Two-phase reviews',
    phaseId: FEASIBILITY_PHASE,
  });
  await createProposalReview({
    assignmentId: feasibilityScenario.assignment.id,
    state: ProposalReviewState.SUBMITTED,
    reviewData: {
      answers: {
        impact: 7,
        feasibility: 4,
        [OVERALL_RECOMMENDATION_KEY]: 'yes',
      },
      rationales: {},
    },
    submittedAt: new Date().toISOString(),
  });

  const communityReviewer = await testData.createReviewer(context);
  const communityAssignment = await createReviewAssignment({
    processInstanceId: context.instance.instance.id,
    proposalId: feasibilityScenario.proposal.id,
    reviewerProfileId: communityReviewer.profileId,
    phaseId: COMMUNITY_PHASE,
  });
  await createProposalReview({
    assignmentId: communityAssignment.id,
    state: ProposalReviewState.SUBMITTED,
    reviewData: {
      answers: {
        impact: 3,
        feasibility: 2,
        [OVERALL_RECOMMENDATION_KEY]: 'no',
      },
      rationales: {},
    },
    submittedAt: new Date().toISOString(),
  });

  await testData.setCurrentPhase(context.instance.instance.id, COMMUNITY_PHASE);

  return {
    context,
    proposal: feasibilityScenario.proposal,
    feasibilityReviewerProfileId: feasibilityScenario.reviewer.profileId,
    communityReviewerProfileId: communityReviewer.profileId,
  };
}

describe.concurrent('getProposalWithReviewAggregates', () => {
  it('rejects callers without admin access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const reviewer = await testData.createInstanceReviewerWithRole(
      created.context,
    );

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: created.context.instance.instance.id,
        proposalId: created.proposal.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('throws NotFound when proposalId belongs to a different instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    const [primary, foreign] = await Promise.all([
      testData.createReviewAssignment({ title: 'Primary' }),
      testData.createReviewAssignment({ title: 'Foreign' }),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      primary.context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: primary.context.instance.instance.id,
        proposalId: foreign.proposal.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('throws NotFound when proposalId does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        proposalId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('returns aggregates and submitted-only reviews[] for a proposal with mixed states', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await advanceToReviewPhase(context.instance.instance.id);

    // Reviewer A: SUBMITTED. Reviewer B: DRAFT. Reviewer C: assigned but no
    // review row at all. All three should count toward assignmentsCount but
    // only A should appear in reviews[].
    const submittedScenario = await testData.createReviewAssignment({
      context,
      title: 'Mixed States',
    });

    const draftReviewer = await testData.createReviewer(context);
    const draftAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: submittedScenario.proposal.id,
      reviewerProfileId: draftReviewer.profileId,
    });

    const noReviewReviewer = await testData.createReviewer(context);
    await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: submittedScenario.proposal.id,
      reviewerProfileId: noReviewReviewer.profileId,
    });

    await createProposalReview({
      assignmentId: submittedScenario.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 7,
          feasibility: 4,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: { impact: 'strong fit' },
      },
      submittedAt: new Date().toISOString(),
    });

    await createProposalReview({
      assignmentId: draftAssignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: {
        answers: { impact: 9, feasibility: 5 },
        rationales: {},
      },
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getProposalWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      proposalId: submittedScenario.proposal.id,
    });

    expect(result.proposal.id).toBe(submittedScenario.proposal.id);
    expect(result.aggregates).toMatchObject({
      assignmentsCount: 3,
      reviewsSubmittedCount: 1,
      averageScore: 11,
      overallRecommendationCount: { yes: 1 },
    });
    expect(result.aggregates.reviewers).toHaveLength(3);

    expect(result.reviews).toHaveLength(1);
    const onlyReview = result.reviews[0]!;
    expect(onlyReview.reviewer.id).toBe(submittedScenario.reviewer.profileId);
    expect(onlyReview.score).toBe(11);
    expect(onlyReview.overallRecommendation).toBe('yes');
    expect(onlyReview.assignmentStatus).toBe(
      ProposalReviewAssignmentStatus.PENDING,
    );
    expect(onlyReview.review.state).toBe(ProposalReviewState.SUBMITTED);
    expect(onlyReview.review.reviewData.answers).toMatchObject({
      impact: 7,
      feasibility: 4,
      [OVERALL_RECOMMENDATION_KEY]: 'yes',
    });
    expect(onlyReview.review.reviewData.rationales).toEqual({
      impact: 'strong fit',
    });
  });

  it('surfaces multiple submitted reviews with per-row scores and recommendations', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await advanceToReviewPhase(context.instance.instance.id);

    const firstScenario = await testData.createReviewAssignment({
      context,
      title: 'Two Reviewers',
    });

    const secondReviewer = await testData.createReviewer(context);
    const secondAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: firstScenario.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
    });

    await createProposalReview({
      assignmentId: firstScenario.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 7,
          feasibility: 4,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    await createProposalReview({
      assignmentId: secondAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 3,
          feasibility: 2,
          [OVERALL_RECOMMENDATION_KEY]: 'no',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getProposalWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      proposalId: firstScenario.proposal.id,
    });

    expect(result.aggregates).toMatchObject({
      assignmentsCount: 2,
      reviewsSubmittedCount: 2,
      averageScore: 8,
      overallRecommendationCount: { yes: 1, no: 1 },
    });

    expect(result.reviews).toHaveLength(2);

    const firstRow = result.reviews.find(
      (r) => r.reviewer.id === firstScenario.reviewer.profileId,
    );
    expect(firstRow?.score).toBe(11);
    expect(firstRow?.overallRecommendation).toBe('yes');
    expect(firstRow?.review.reviewData.answers).toMatchObject({
      impact: 7,
      feasibility: 4,
    });

    const secondRow = result.reviews.find(
      (r) => r.reviewer.id === secondReviewer.profileId,
    );
    expect(secondRow?.score).toBe(5);
    expect(secondRow?.overallRecommendation).toBe('no');
    expect(secondRow?.review.reviewData.answers).toMatchObject({
      impact: 3,
      feasibility: 2,
    });
  });

  // --- Open Reviews read gate ------------------------------------------------
  // Admin OR (REVIEW access AND an explicit `phaseId` whose `openReviews` is
  // on). These cases exercise the single-review-phase shape where the named
  // phase is the current one; the phase-scoping describe below covers the
  // multi-phase matrix.

  it('admits an admin even when the current phase has openReviews off', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      false,
    );
    await advanceToReviewPhase(context.instance.instance.id);

    const scenario = await testData.createReviewAssignment({
      context,
      title: 'Admin reads with openReviews off',
    });
    await createProposalReview({
      assignmentId: scenario.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 7,
          feasibility: 4,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    // defaultReviewer holds profile-admin access on the instance.
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getProposalWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      proposalId: scenario.proposal.id,
    });

    expect(result.proposal.id).toBe(scenario.proposal.id);
    expect(result.reviews).toHaveLength(1);
  });

  it('denies a reviewer (REVIEW, no admin) when openReviews is off', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      false,
    );
    await advanceToReviewPhase(context.instance.instance.id);

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    // The reviewer even holds an assignment on this proposal — still denied,
    // because the own-assignment review flow is a separate gate.
    const scenario = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Reviewer blocked while openReviews off',
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        proposalId: scenario.proposal.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('admits a reviewer with an assignment when openReviews is on, exposing peers reviews', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );
    await advanceToReviewPhase(context.instance.instance.id);

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const scenario = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Open reviews visible to peer reviewer',
    });

    // A different reviewer submits a review on the same proposal.
    const peerReviewer = await testData.createReviewer(context);
    const peerAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: scenario.proposal.id,
      reviewerProfileId: peerReviewer.profileId,
    });
    await createProposalReview({
      assignmentId: peerAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 6,
          feasibility: 3,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    const result =
      await reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        proposalId: scenario.proposal.id,
        phaseId: 'review',
      });

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]!.reviewer.id).toBe(peerReviewer.profileId);
    expect(result.reviews[0]!.review.state).toBe(ProposalReviewState.SUBMITTED);
  });

  it('admits a reviewer with NO assignment on the proposal when openReviews is on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );
    await advanceToReviewPhase(context.instance.instance.id);

    // Proposal + a submitted review owned by someone else entirely.
    const scenario = await testData.createReviewAssignment({
      context,
      title: 'Process-wide open reviews',
    });
    await createProposalReview({
      assignmentId: scenario.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 8,
          feasibility: 5,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    // An unrelated reviewer: REVIEW access in the process, no assignment here.
    const outsideReviewer =
      await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(
      outsideReviewer.email,
    );

    const result =
      await reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        proposalId: scenario.proposal.id,
        phaseId: 'review',
      });

    expect(result.proposal.id).toBe(scenario.proposal.id);
    expect(result.reviews).toHaveLength(1);
  });

  it('denies a participant without REVIEW access even when openReviews is on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );
    await advanceToReviewPhase(context.instance.instance.id);

    const scenario = await testData.createReviewAssignment({
      context,
      title: 'Member cannot read reviews',
    });

    // READ-only member: no REVIEW, no ADMIN.
    const member = await testData.createInstanceMember(context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        proposalId: scenario.proposal.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('never surfaces draft reviews even when openReviews is on', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );
    await advanceToReviewPhase(context.instance.instance.id);

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const scenario = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Draft stays hidden under open reviews',
    });

    // One peer with a SUBMITTED review, one with a DRAFT review.
    const submittedPeer = await testData.createReviewer(context);
    const submittedAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: scenario.proposal.id,
      reviewerProfileId: submittedPeer.profileId,
    });
    await createProposalReview({
      assignmentId: submittedAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 5,
          feasibility: 2,
          [OVERALL_RECOMMENDATION_KEY]: 'no',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    const draftPeer = await testData.createReviewer(context);
    const draftAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: scenario.proposal.id,
      reviewerProfileId: draftPeer.profileId,
    });
    await createProposalReview({
      assignmentId: draftAssignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: {
        answers: { impact: 9, feasibility: 5 },
        rationales: {},
      },
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    const result =
      await reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        proposalId: scenario.proposal.id,
        phaseId: 'review',
      });

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]!.reviewer.id).toBe(submittedPeer.profileId);
    expect(
      result.reviews.some((r) => r.reviewer.id === draftPeer.profileId),
    ).toBe(false);
  });
});

// --- Phase-scoped aggregates + previous-phase visibility (PR 6) -------------
// `phaseId` scopes the review set to that phase's assignments. Reviewers must
// name a phase and get it only when THAT phase's `openReviews` is on — which
// keeps an open earlier phase readable after it ends (Columbus budget
// delegates reading feasibility reviews) without exposing any closed phase.

describe.concurrent('getProposalWithReviewAggregates phase scoping', () => {
  it('admin without phaseId defaults to the current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);

    const adminCaller = await createAuthenticatedCaller(
      seeded.context.defaultReviewer.email,
    );

    // The instance sits on the community phase, so the earlier feasibility
    // review must not appear.
    const result = await adminCaller.decision.getProposalWithReviewAggregates({
      processInstanceId: seeded.context.instance.instance.id,
      proposalId: seeded.proposal.id,
    });

    expect(result.aggregates.assignmentsCount).toBe(1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]!.reviewer.id).toBe(
      seeded.communityReviewerProfileId,
    );
  });

  it('admin with phaseId reads only that phase, aggregates included', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);

    const adminCaller = await createAuthenticatedCaller(
      seeded.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getProposalWithReviewAggregates({
      processInstanceId: seeded.context.instance.instance.id,
      proposalId: seeded.proposal.id,
      phaseId: FEASIBILITY_PHASE,
    });

    expect(result.aggregates.assignmentsCount).toBe(1);
    expect(result.aggregates.reviewsSubmittedCount).toBe(1);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]!.reviewer.id).toBe(
      seeded.feasibilityReviewerProfileId,
    );
  });

  it('reviewer naming the current phase with openReviews on sees only current-phase reviews', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);
    await testData.setPhaseOpenReviews(
      seeded.context.instance.instance.id,
      COMMUNITY_PHASE,
      true,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(
      seeded.context,
    );
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    const result =
      await reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: seeded.context.instance.instance.id,
        proposalId: seeded.proposal.id,
        phaseId: COMMUNITY_PHASE,
      });

    // The feasibility review on the same proposal must NOT be blended in.
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]!.reviewer.id).toBe(
      seeded.communityReviewerProfileId,
    );
  });

  it('reviewer reads an earlier open phase even while the current phase is closed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);
    // Feasibility ran open; the community phase (current) keeps its own
    // reviews closed — the budget-delegate configuration.
    await testData.setPhaseOpenReviews(
      seeded.context.instance.instance.id,
      FEASIBILITY_PHASE,
      true,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(
      seeded.context,
    );
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    const result =
      await reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: seeded.context.instance.instance.id,
        proposalId: seeded.proposal.id,
        phaseId: FEASIBILITY_PHASE,
      });

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0]!.reviewer.id).toBe(
      seeded.feasibilityReviewerProfileId,
    );
  });

  it('denies a reviewer naming an earlier phase whose openReviews is off', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);
    // The CURRENT phase being open must not leak the closed earlier phase.
    await testData.setPhaseOpenReviews(
      seeded.context.instance.instance.id,
      COMMUNITY_PHASE,
      true,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(
      seeded.context,
    );
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: seeded.context.instance.instance.id,
        proposalId: seeded.proposal.id,
        phaseId: FEASIBILITY_PHASE,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('denies a reviewer who names no phase, even when every phase is open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);
    await testData.setPhaseOpenReviews(
      seeded.context.instance.instance.id,
      FEASIBILITY_PHASE,
      true,
    );
    await testData.setPhaseOpenReviews(
      seeded.context.instance.instance.id,
      COMMUNITY_PHASE,
      true,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(
      seeded.context,
    );
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    // The read gate uses the caller's raw phaseId, so reviewer-tier callers
    // must always name a phase — omitting it is rejected outright even
    // though admins get the current-phase default.
    await expect(
      reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: seeded.context.instance.instance.id,
        proposalId: seeded.proposal.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('denies a reviewer naming a phase later than the current one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedTwoPhaseReviews(testData);
    // Wind the instance back to feasibility; the (open) community phase now
    // lies in the future and must not be readable.
    await testData.setPhaseOpenReviews(
      seeded.context.instance.instance.id,
      COMMUNITY_PHASE,
      true,
    );
    await testData.setCurrentPhase(
      seeded.context.instance.instance.id,
      FEASIBILITY_PHASE,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(
      seeded.context,
    );
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: seeded.context.instance.instance.id,
        proposalId: seeded.proposal.id,
        phaseId: COMMUNITY_PHASE,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describeDecisionAccessTierGating('getProposalWithReviewAggregates', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'no-JWT should not reach this' },
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getProposalWithReviewAggregates({
          processInstanceId: instance.instance.id,
          proposalId: proposal.id,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getProposalWithReviewAggregates({
          processInstanceId: instance.instance.id,
          proposalId: proposal.id,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getProposalWithReviewAggregates({
          processInstanceId: instance.instance.id,
          proposalId: proposal.id,
        }),
        'user',
      );
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
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Common-JWT owner reads aggregates' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.getProposalWithReviewAggregates({
        processInstanceId: instance.instance.id,
        proposalId: proposal.id,
      });

      expect(result.proposal.id).toBe(proposal.id);
    },
  ),
});

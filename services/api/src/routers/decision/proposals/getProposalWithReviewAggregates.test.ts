import type { RubricTemplateSchema } from '@op/common';
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
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
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
});

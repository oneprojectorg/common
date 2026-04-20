import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { db } from '@op/db/test';
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
  'x-field-order': ['impact'],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Low' },
        { const: 2, title: 'Medium' },
        { const: 3, title: 'High' },
      ],
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('saveReviewDraft', () => {
  it('creates a draft and transitions the assignment to IN_PROGRESS', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 2 },
        rationales: { impact: 'Still weighing tradeoffs' },
      },
      overallComment: 'Leaning positive',
    });

    expect(result.state).toBe(ProposalReviewState.DRAFT);
    expect(result.submittedAt).toBeNull();
    expect(result.reviewData.answers).toEqual({ impact: 2 });
    expect(result.reviewData.rationales).toEqual({
      impact: 'Still weighing tradeoffs',
    });
    expect(result.overallComment).toBe('Leaning positive');

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: {
        id: created.assignment.id,
      },
      with: { reviews: true },
    });

    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.IN_PROGRESS);
    expect(assignment?.completedAt).toBeNull();
    expect(assignment?.reviews[0]?.state).toBe(ProposalReviewState.DRAFT);
    expect(assignment?.reviews[0]?.submittedAt).toBeNull();
  });

  it('is idempotent — repeated saves upsert the same draft row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 1 },
        rationales: {},
      },
    });

    const second = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 3 },
        rationales: { impact: 'Updated rationale' },
      },
      overallComment: 'Changed my mind',
    });

    expect(second.state).toBe(ProposalReviewState.DRAFT);
    expect(second.reviewData.answers).toEqual({ impact: 3 });
    expect(second.reviewData.rationales).toEqual({
      impact: 'Updated rationale',
    });
    expect(second.overallComment).toBe('Changed my mind');

    const reviews = await db.query.proposalReviews.findMany({
      where: {
        assignmentId: created.assignment.id,
      },
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.state).toBe(ProposalReviewState.DRAFT);
  });

  it('lets submitReview promote a saved draft to SUBMITTED', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 2 },
        rationales: { impact: 'Draft notes' },
      },
    });

    const submitted = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 3 },
        rationales: { impact: 'Final notes' },
      },
      overallComment: 'Ship it',
    });

    expect(submitted.state).toBe(ProposalReviewState.SUBMITTED);
    expect(submitted.submittedAt).toBeTruthy();
    expect(submitted.reviewData.answers).toEqual({ impact: 3 });
    expect(submitted.reviewData.rationales).toEqual({
      impact: 'Final notes',
    });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: {
        id: created.assignment.id,
      },
      with: { reviews: true },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.COMPLETED);
    expect(assignment?.reviews).toHaveLength(1);
    expect(assignment?.reviews[0]?.state).toBe(ProposalReviewState.SUBMITTED);
  });

  it('refuses to save a draft after the review has been submitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 3 },
        rationales: { impact: 'Final' },
      },
      overallComment: 'Submitted',
    });

    await expect(
      reviewerCaller.decision.saveReviewDraft({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: { impact: 1 },
          rationales: { impact: 'Trying to overwrite' },
        },
        overallComment: 'New draft',
      }),
    ).rejects.toThrow('Review has already been submitted');

    const review = await db.query.proposalReviews.findFirst({
      where: {
        assignmentId: created.assignment.id,
      },
    });
    expect(review?.state).toBe(ProposalReviewState.SUBMITTED);
    expect(review?.reviewData).toMatchObject({
      answers: { impact: 3 },
      rationales: { impact: 'Final' },
    });
    expect(review?.overallComment).toBe('Submitted');
  });

  it('rejects callers who are not the assigned reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);
    const otherReviewer = await testData.createReviewer(created.context);

    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);

    await expect(
      otherCaller.decision.saveReviewDraft({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: { impact: 2 },
          rationales: {},
        },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('accepts a fully empty payload via schema defaults', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const result = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: {},
        rationales: {},
      },
    });

    expect(result.state).toBe(ProposalReviewState.DRAFT);
    expect(result.reviewData.answers).toEqual({});
    expect(result.reviewData.rationales).toEqual({});
    expect(result.overallComment).toBeNull();
  });

  it('does not downgrade non-PENDING assignment statuses', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 2 },
        rationales: {},
      },
    });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: {
        id: created.assignment.id,
      },
    });
    expect(assignment?.status).toBe(
      ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    );
  });
});

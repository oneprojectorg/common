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

describe.concurrent('submitReview', () => {
  it('submits a valid review and completes the assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 3 },
        rationales: { impact: 'Solid execution plan' },
      },
      overallComment: 'Ready to move forward',
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.submittedAt).toBeTruthy();
    expect(result.reviewData.answers).toEqual({ impact: 3 });
    expect(result.reviewData.rationales).toEqual({
      impact: 'Solid execution plan',
    });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: {
        id: created.assignment.id,
      },
      with: { reviews: true },
    });

    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.COMPLETED);
    expect(assignment?.completedAt).toBeTruthy();
    expect(assignment?.reviews[0]?.state).toBe(ProposalReviewState.SUBMITTED);
    expect(assignment?.reviews[0]?.reviewData).toMatchObject({
      answers: { impact: 3 },
      rationales: { impact: 'Solid execution plan' },
    });
  });

  it('accepts submissions with empty rationales', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 2 },
        rationales: {},
      },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.rationales).toEqual({});
  });

  it('rejects invalid rubric submissions', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {},
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });
});

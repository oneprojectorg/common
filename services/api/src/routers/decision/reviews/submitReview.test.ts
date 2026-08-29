import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { reviseProposal } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

const singleSelectRubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['department'],
  properties: {
    department: {
      type: 'string',
      title: 'Department',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'a1b2c3d4', title: 'Parks' },
        { const: 'e5f6a7b8', title: 'Transportation' },
        { const: 'c9d0e1f2', title: 'Public Health' },
      ],
    },
  },
  required: ['department'],
};

const moneyRubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['cost', 'impact'],
  properties: {
    cost: {
      type: 'object',
      title: 'Estimated cost',
      'x-format': 'money',
      properties: {
        amount: { type: 'number', minimum: 0 },
        currency: { type: 'string', const: 'USD', default: 'USD' },
      },
      required: ['amount', 'currency'],
      additionalProperties: false,
    },
    impact: {
      type: 'integer',
      title: 'Impact',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Low' },
        { const: 5, title: 'High' },
      ],
    },
  },
  required: ['cost', 'impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Creates an assignment (in its current phase) with the rubric set. */
async function createAssignmentWithRubric(
  testData: TestReviewsDataManager,
  rubric: RubricTemplateSchema = rubricTemplate,
) {
  const created = await testData.createReviewAssignment();
  await testData.setRubricTemplate(created.context, rubric);
  return created;
}

describe.concurrent('submitReview', () => {
  it('submits a valid review and completes the assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

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
    const created = await createAssignmentWithRubric(testData);

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

  it('accepts a single-select answer with a known option id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(
      testData,
      singleSelectRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { department: 'a1b2c3d4' },
        rationales: {},
      },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.answers).toEqual({ department: 'a1b2c3d4' });
  });

  it('rejects a single-select answer with an unknown option id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(
      testData,
      singleSelectRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: { department: 'not-an-option' },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('accepts an array answer for a single-select field by coercing to its first element', async ({
    task,
    onTestFinished,
  }) => {
    // `coerceToSchema` unwraps an array to `value[0]` before validation, so
    // a single-item array of a known option id passes; the stored answer
    // keeps its original array shape since only the validation copy is
    // coerced.
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(
      testData,
      singleSelectRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { department: ['e5f6a7b8'] },
        rationales: {},
      },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.answers).toEqual({ department: ['e5f6a7b8'] });
  });

  it('accepts a money answer and stores it verbatim', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(
      testData,
      moneyRubricTemplate,
    );
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'review',
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const answers = { cost: { amount: 120000.5, currency: 'USD' }, impact: 5 };
    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: { answers, rationales: {} },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.answers).toEqual(answers);

    // Only `impact` scores: 5, not 5 + 120000.5.
    const aggregates = await reviewerCaller.decision.listWithReviewAggregates({
      processInstanceId: created.context.instance.instance.id,
      proposalIds: [created.proposal.id],
    });
    expect(aggregates.items[0]?.aggregates).toMatchObject({
      reviewsSubmittedCount: 1,
      averageScore: 5,
    });
  });

  it('allows a first submit while the assignment phase is the current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    // createReviewAssignment leaves the instance on the assignment's phase.
    const created = await createAssignmentWithRubric(testData);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 3 }, rationales: {} },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
  });

  it('rejects a first submit once the instance advances past the assignment phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

    // Assignments survive a phase advance, so a never-submitted assignment
    // from an earlier phase is still loadable — it just can't be written.
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'voting',
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: { answers: { impact: 3 }, rationales: {} },
      }),
    ).rejects.toThrow('the review phase has ended');

    // Nothing was written.
    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });
    expect(review).toBeUndefined();

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).not.toBe(
      ProposalReviewAssignmentStatus.COMPLETED,
    );
  });

  it("stamps the assignment's version pin to the proposal's current history row", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);

    // The author edits after the assignment was created, so the pin the
    // assignment carries is already behind the proposal.
    const currentHistoryId = await reviseProposal({
      proposalId: created.proposal.id,
      proposalData: { title: 'Community Garden Expansion (revised)' },
    });

    const assignmentBefore = await db.query.proposalReviewAssignments.findFirst(
      {
        where: { id: created.assignment.id },
      },
    );
    expect(assignmentBefore?.assignedProposalHistoryId).not.toBe(
      currentHistoryId,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 3 }, rationales: {} },
    });

    const assignmentAfter = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });

    // The pin now records the version the reviewer actually reviewed.
    expect(assignmentAfter?.assignedProposalHistoryId).toBe(currentHistoryId);
  });

  it('rejects invalid rubric submissions', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

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

describeDecisionAccessTierGating('submitReview', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitReview({
          assignmentId: crypto.randomUUID(),
          reviewData: {},
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitReview({
          assignmentId: crypto.randomUUID(),
          reviewData: {},
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitReview({
          assignmentId: crypto.randomUUID(),
          reviewData: {},
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      await expect(
        caller.decision.submitReview({
          assignmentId: crypto.randomUUID(),
          reviewData: {},
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),
});

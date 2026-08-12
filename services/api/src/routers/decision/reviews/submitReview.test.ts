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

/**
 * Budget add-up: one composite criterion whose nested properties are money
 * line items plus the group currency. The total is never stored.
 */
const budgetAddUpRubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['b7e41c93'],
  properties: {
    b7e41c93: {
      type: 'object',
      title: 'Total Estimated Cost',
      'x-format': 'money-group',
      properties: {
        a1b2c3d4: { type: 'number', title: 'Design & Engineering', minimum: 0 },
        e5f6a7b8: { type: 'number', title: 'Construction', minimum: 0 },
        currency: { type: 'string', const: 'USD', default: 'USD' },
      },
      // Nothing beyond the line items and the currency may be stored — this
      // is what keeps the derived total from ever being persisted.
      additionalProperties: false,
      required: ['a1b2c3d4', 'e5f6a7b8', 'currency'],
      'x-field-order': ['a1b2c3d4', 'e5f6a7b8'],
    },
  },
  required: ['b7e41c93'],
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

  it('accepts a single-select answer with a known option id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
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
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
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
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
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

  it('stores a budget add-up answer verbatim, currency included', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
      budgetAddUpRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: {
          b7e41c93: {
            a1b2c3d4: 12000.5,
            e5f6a7b8: 3000,
            currency: 'USD',
          },
        },
        rationales: { b7e41c93: 'Costs are conservative' },
      },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    // No `total` key: totals are derived at read time, never stored.
    expect(result.reviewData.answers).toEqual({
      b7e41c93: {
        a1b2c3d4: 12000.5,
        e5f6a7b8: 3000,
        currency: 'USD',
      },
    });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
      with: { reviews: true },
    });

    expect(assignment?.reviews[0]?.reviewData).toMatchObject({
      answers: {
        b7e41c93: {
          a1b2c3d4: 12000.5,
          e5f6a7b8: 3000,
          currency: 'USD',
        },
      },
    });
  });

  it('rejects a budget add-up missing a required line item', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
      budgetAddUpRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            b7e41c93: { a1b2c3d4: 12000, currency: 'USD' },
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects a budget add-up carrying a derived total', async ({
    task,
    onTestFinished,
  }) => {
    // The total is derived at read time and must never be persisted;
    // `additionalProperties: false` is what enforces that server-side.
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
      budgetAddUpRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            b7e41c93: {
              a1b2c3d4: 12000,
              e5f6a7b8: 3000,
              currency: 'USD',
              total: 15000,
            },
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects a budget add-up whose currency is not the group currency', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
      budgetAddUpRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            b7e41c93: { a1b2c3d4: 12000, e5f6a7b8: 3000, currency: 'EUR' },
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects a budget add-up with a malformed currency code', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
      budgetAddUpRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            b7e41c93: {
              a1b2c3d4: 12000,
              e5f6a7b8: 3000,
              currency: 'not-a-code',
            },
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects a negative budget add-up amount', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(
      created.context,
      budgetAddUpRubricTemplate,
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            b7e41c93: {
              a1b2c3d4: -1,
              e5f6a7b8: 3000,
              currency: 'USD',
            },
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
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

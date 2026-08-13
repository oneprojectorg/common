import type { RubricTemplateSchema } from '@op/common';
import { OVERALL_RECOMMENDATION_KEY } from '@op/common/client';
import { ProposalReviewState } from '@op/db/schema';
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

/**
 * Columbus feasibility shape (flat slice): three flat money criteria plus a
 * scored criterion. Criterion ids are opaque, as the builder generates them.
 *
 * Every answer lives at `answers[criterionId]` — one top-level key per money
 * criterion — which is what these tests assert.
 */
const DESIGN = 'a1b2c3d4';
const CONSTRUCTION = 'e5f6a7b8';
const CONTINGENCY = 'c9d0e1f2';

function moneyCriterion(title: string, currency = 'USD') {
  return {
    type: 'object' as const,
    title,
    'x-format': 'money' as const,
    properties: {
      amount: { type: 'number' as const, minimum: 0 },
      currency: { type: 'string' as const, const: currency, default: currency },
    },
    required: ['amount', 'currency'],
    additionalProperties: false,
  };
}

const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': [
    DESIGN,
    CONSTRUCTION,
    CONTINGENCY,
    'impact',
    OVERALL_RECOMMENDATION_KEY,
  ],
  properties: {
    [DESIGN]: moneyCriterion('Design & Engineering Cost'),
    [CONSTRUCTION]: moneyCriterion('Construction / Materials / Labor'),
    [CONTINGENCY]: moneyCriterion(
      'Contingency & Permitting (15–20% recommended)',
    ),
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
    [OVERALL_RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Overall Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
  },
  required: [DESIGN, CONSTRUCTION, 'impact'],
};

const validMoneyAnswers = {
  [DESIGN]: { amount: 120000, currency: 'USD' },
  [CONSTRUCTION]: { amount: 480000.5, currency: 'USD' },
  [CONTINGENCY]: { amount: 90000, currency: 'USD' },
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function seedAssignment(
  task: { id: string },
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const testData = new TestReviewsDataManager(task.id, onTestFinished);
  const created = await testData.createReviewAssignment();
  await testData.setRubricTemplate(created.context, rubricTemplate);
  const caller = await createAuthenticatedCaller(created.reviewer.email);
  return { testData, created, caller };
}

describe.concurrent('rubric money criteria', () => {
  it('accepts valid money answers and stores them verbatim', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    const result = await caller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { ...validMoneyAnswers, impact: 5 },
        rationales: {},
      },
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.answers).toEqual({
      ...validMoneyAnswers,
      impact: 5,
    });

    // Read back from the DB: each money answer is its own top-level key.
    const stored = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });
    expect(stored?.reviewData).toMatchObject({ answers: validMoneyAnswers });
  });

  it('rejects a submission missing a required money criterion', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    await expect(
      caller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: { [DESIGN]: validMoneyAnswers[DESIGN], impact: 5 },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects a negative amount', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    await expect(
      caller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            ...validMoneyAnswers,
            [DESIGN]: { amount: -1, currency: 'USD' },
            impact: 5,
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects an unknown extra key inside a money answer', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    // `additionalProperties: false` is what makes the derived total
    // unstorable — there is nowhere to smuggle it.
    await expect(
      caller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            ...validMoneyAnswers,
            [DESIGN]: { amount: 100, currency: 'USD', total: 999999 },
            impact: 5,
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('rejects a mismatched or malformed currency', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    await expect(
      caller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            ...validMoneyAnswers,
            [DESIGN]: { amount: 100, currency: 'EUR' },
            impact: 5,
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');

    await expect(
      caller.decision.submitReview({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: {
            ...validMoneyAnswers,
            [DESIGN]: { amount: 100, currency: 42 },
            impact: 5,
          },
          rationales: {},
        },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it('leaves the aggregated score untouched by money answers', async (ctx) => {
    const { testData, created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'review',
    );

    await caller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: {
          ...validMoneyAnswers,
          impact: 5,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
    });

    const aggregates = await caller.decision.listWithReviewAggregates({
      processInstanceId: created.context.instance.instance.id,
      proposalIds: [created.proposal.id],
    });

    // Only `impact` scores: 5, not 5 + 690000.5.
    expect(aggregates.items[0]?.aggregates).toMatchObject({
      reviewsSubmittedCount: 1,
      averageScore: 5,
    });
  });

  it('saves a draft with partial money answers', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    // Drafts are deliberately unvalidated: a half-filled money answer and a
    // completely missing required one both persist.
    const partial = {
      [DESIGN]: { amount: 120000, currency: 'USD' },
      [CONSTRUCTION]: { currency: 'USD' },
    };

    const draft = await caller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: { answers: partial, rationales: {} },
    });

    expect(draft.state).toBe(ProposalReviewState.DRAFT);
    expect(draft.reviewData.answers).toEqual(partial);
  });

  it('stores a rationale per money criterion under its own criterion id', async (ctx) => {
    const { created, caller } = await seedAssignment(
      ctx.task,
      ctx.onTestFinished,
    );

    const rationales = {
      [DESIGN]: 'Based on the 2025 city schedule of rates.',
      [CONSTRUCTION]: 'Assumes union labour.',
      [CONTINGENCY]: '18% of the two lines above.',
    };

    const result = await caller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { ...validMoneyAnswers, impact: 5 },
        rationales,
      },
    });

    // Per-field notes need no new storage: the existing flat rationale map
    // keys on the same criterion ids as the answers.
    expect(result.reviewData.rationales).toEqual(rationales);

    const stored = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });
    expect(stored?.reviewData).toMatchObject({ rationales });
  });
});

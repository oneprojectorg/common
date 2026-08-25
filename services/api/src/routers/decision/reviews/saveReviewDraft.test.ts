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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Creates an assignment (in its current phase) with the rubric set. */
async function createAssignmentWithRubric(
  testData: TestReviewsDataManager,
  opts: { status?: ProposalReviewAssignmentStatus } = {},
) {
  const created = await testData.createReviewAssignment(opts);
  await testData.setRubricTemplate(created.context, rubricTemplate);
  return created;
}

describe.concurrent('saveReviewDraft', () => {
  it('creates a draft and transitions the assignment to IN_PROGRESS', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 2 },
        rationales: { impact: 'Still weighing tradeoffs' },
      },
    });

    expect(result.state).toBe(ProposalReviewState.DRAFT);
    expect(result.submittedAt).toBeNull();
    expect(result.reviewData.answers).toEqual({ impact: 2 });
    expect(result.reviewData.rationales).toEqual({
      impact: 'Still weighing tradeoffs',
    });

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

  it('upserts a single draft row per assignment — last write wins', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

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
    });

    expect(second.state).toBe(ProposalReviewState.DRAFT);
    expect(second.reviewData.answers).toEqual({ impact: 3 });
    expect(second.reviewData.rationales).toEqual({
      impact: 'Updated rationale',
    });

    const reviews = await db.query.proposalReviews.findMany({
      where: {
        assignmentId: created.assignment.id,
      },
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.state).toBe(ProposalReviewState.DRAFT);
  });

  it('refuses to save a draft after the review has been submitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await reviewerCaller.decision.submitReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 3 },
        rationales: { impact: 'Final' },
      },
    });

    await expect(
      reviewerCaller.decision.saveReviewDraft({
        assignmentId: created.assignment.id,
        reviewData: {
          answers: { impact: 1 },
          rationales: { impact: 'Trying to overwrite' },
        },
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
  });

  it('rejects callers who are not the assigned reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);
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
    const created = await createAssignmentWithRubric(testData);

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

  it('persists overallComment on the draft and round-trips updates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const first = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 2 }, rationales: {} },
      overallComment: 'Initial feedback draft',
    });

    expect(first.overallComment).toBe('Initial feedback draft');

    // Upsert path: an edit to overallComment should overwrite, and clearing
    // it should persist as null.
    const second = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 2 }, rationales: {} },
      overallComment: 'Revised feedback draft',
    });
    expect(second.overallComment).toBe('Revised feedback draft');

    const cleared = await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 2 }, rationales: {} },
      overallComment: null,
    });
    expect(cleared.overallComment).toBeNull();

    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });
    expect(review?.state).toBe(ProposalReviewState.DRAFT);
    expect(review?.overallComment).toBeNull();
  });

  it('rejects a draft save once the instance advances past the assignment phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData);

    // Assignments survive a phase advance, so the leftover assignment still
    // loads — but a first draft must not be written against a closed phase.
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'voting',
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.saveReviewDraft({
        assignmentId: created.assignment.id,
        reviewData: { answers: { impact: 2 }, rationales: {} },
      }),
    ).rejects.toThrow('the review phase has ended');

    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });
    expect(review).toBeUndefined();

    // The status stays PENDING: no draft, so no "review started" transition.
    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.PENDING);
  });

  it('does not downgrade non-PENDING assignment statuses', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentWithRubric(testData, {
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

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

describeDecisionAccessTierGating('saveReviewDraft', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.saveReviewDraft({
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
        caller.decision.saveReviewDraft({
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
        caller.decision.saveReviewDraft({
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
        caller.decision.saveReviewDraft({
          assignmentId: crypto.randomUUID(),
          reviewData: {},
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),
});

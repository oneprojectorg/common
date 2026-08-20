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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Submits a valid review and moves the instance to the assignment's phase so
 * the submitted review is editable. Returns the reviewer caller + ids.
 */
async function submitEditableReview(
  testData: TestReviewsDataManager,
  opts: { setCurrentPhaseToReview?: boolean } = {},
) {
  const { setCurrentPhaseToReview = true } = opts;
  const created = await testData.createReviewAssignment();
  await testData.setRubricTemplate(created.context, rubricTemplate);

  const reviewerCaller = await createAuthenticatedCaller(
    created.reviewer.email,
  );

  await reviewerCaller.decision.submitReview({
    assignmentId: created.assignment.id,
    reviewData: {
      answers: { impact: 3 },
      rationales: { impact: 'Solid execution plan' },
    },
    overallComment: 'Ready to move forward',
  });

  if (setCurrentPhaseToReview) {
    // Assignments default to phase 'review'; the instance starts on the first
    // phase ('submission'), so stamp the current phase to make edits allowed.
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'review',
    );
  }

  return { created, reviewerCaller };
}

describe.concurrent('updateReview', () => {
  it('edits a submitted review in place, preserving submission state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { created, reviewerCaller } = await submitEditableReview(testData);

    const before = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });

    const result = await reviewerCaller.decision.updateReview({
      assignmentId: created.assignment.id,
      reviewData: {
        answers: { impact: 2 },
        rationales: { impact: 'Reassessed after committee discussion' },
      },
      overallComment: 'Some concerns remain',
    });

    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.answers).toEqual({ impact: 2 });
    expect(result.reviewData.rationales).toEqual({
      impact: 'Reassessed after committee discussion',
    });
    expect(result.overallComment).toBe('Some concerns remain');
    // submittedAt is preserved; only updatedAt advances (the "edited" signal).
    expect(result.submittedAt).toBe(before?.submittedAt);

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
      with: { reviews: true },
    });

    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.COMPLETED);
    expect(assignment?.reviews[0]?.state).toBe(ProposalReviewState.SUBMITTED);
    expect(assignment?.reviews[0]?.reviewData).toMatchObject({
      answers: { impact: 2 },
    });
  });

  it('re-affirms an out-of-date review: re-stamps the pin and advances submittedAt', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { created, reviewerCaller } = await submitEditableReview(testData);

    const before = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });

    // The author edits the proposal, so the submitted review falls behind.
    const currentHistoryId = await reviseProposal({
      proposalId: created.proposal.id,
      proposalData: { title: 'Community Garden Expansion (revised)' },
    });

    const staleAssignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(staleAssignment?.assignedProposalHistoryId).not.toBe(
      currentHistoryId,
    );

    const result = await reviewerCaller.decision.updateReview({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 2 }, rationales: {} },
      overallComment: 'Still supportive after the revision',
    });

    // A re-affirm is a fresh judgement of the current version.
    expect(result.submittedAt).not.toBe(before?.submittedAt);
    expect(new Date(result.submittedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(before?.submittedAt ?? 0).getTime(),
    );

    const assignmentAfter = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });

    expect(assignmentAfter?.assignedProposalHistoryId).toBe(currentHistoryId);
    // The review stays a normal completed review underneath.
    expect(assignmentAfter?.status).toBe(
      ProposalReviewAssignmentStatus.COMPLETED,
    );
    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
  });

  it('leaves the pin and submittedAt alone when the review is already current', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { created, reviewerCaller } = await submitEditableReview(testData);

    const assignmentBefore = await db.query.proposalReviewAssignments.findFirst(
      {
        where: { id: created.assignment.id },
      },
    );
    const before = await db.query.proposalReviews.findFirst({
      where: { assignmentId: created.assignment.id },
    });

    const result = await reviewerCaller.decision.updateReview({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 1 }, rationales: {} },
    });

    const assignmentAfter = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });

    expect(result.submittedAt).toBe(before?.submittedAt);
    expect(assignmentAfter?.assignedProposalHistoryId).toBe(
      assignmentBefore?.assignedProposalHistoryId,
    );
  });

  it('rejects editing a review that has not been submitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    await testData.setRubricTemplate(created.context, rubricTemplate);
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'review',
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    // A draft (or absent) review can't be edited via updateReview.
    await reviewerCaller.decision.saveReviewDraft({
      assignmentId: created.assignment.id,
      reviewData: { answers: { impact: 1 }, rationales: {} },
    });

    await expect(
      reviewerCaller.decision.updateReview({
        assignmentId: created.assignment.id,
        reviewData: { answers: { impact: 2 }, rationales: {} },
      }),
    ).rejects.toThrow('Review has not been submitted yet');
  });

  it('rejects edits once the instance advances past the review phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { created, reviewerCaller } = await submitEditableReview(testData, {
      setCurrentPhaseToReview: false,
    });

    // Advance the instance to a later phase than the assignment's 'review'.
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'voting',
    );

    await expect(
      reviewerCaller.decision.updateReview({
        assignmentId: created.assignment.id,
        reviewData: { answers: { impact: 2 }, rationales: {} },
      }),
    ).rejects.toThrow('the review phase has ended');
  });

  it('rejects invalid rubric edits', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { created, reviewerCaller } = await submitEditableReview(testData);

    await expect(
      reviewerCaller.decision.updateReview({
        assignmentId: created.assignment.id,
        reviewData: { answers: {}, rationales: {} },
      }),
    ).rejects.toThrow('Rubric validation failed');
  });

  it("rejects a reviewer editing another reviewer's review", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { created } = await submitEditableReview(testData);

    // A reviewer WITH review capability but who doesn't own this assignment —
    // so the request clears the review-access gate and fails on ownership.
    const otherReviewer = await testData.createInstanceReviewerWithRole(
      created.context,
    );
    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);

    await expect(
      otherCaller.decision.updateReview({
        assignmentId: created.assignment.id,
        reviewData: { answers: { impact: 2 }, rationales: {} },
      }),
    ).rejects.toThrow("don't have access to this review assignment");
  });
});

describeDecisionAccessTierGating('updateReview', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.updateReview({
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
        caller.decision.updateReview({
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
        caller.decision.updateReview({
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
        caller.decision.updateReview({
          assignmentId: crypto.randomUUID(),
          reviewData: {},
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),
});

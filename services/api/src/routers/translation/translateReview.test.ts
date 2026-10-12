import {
  TestReviewsDataManager,
  createProposalReview,
} from '@op/common/testing';
import { db } from '@op/db/client';
import { ProposalReviewState, contentTranslations } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../test/helpers/gating/decision';
import { mockTranslateText } from '../../test/mocks/deepl';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * A submitted review written by a non-admin reviewer (REVIEW role only), so
 * the reviewer's own-review path is exercised rather than the admin bypass.
 */
async function createSubmittedReviewScenario(
  testData: TestReviewsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
  state: ProposalReviewState = ProposalReviewState.SUBMITTED,
) {
  const context = await testData.createContext();
  const reviewer = await testData.createInstanceReviewerWithRole(context);
  const created = await testData.createReviewAssignment({
    context,
    reviewer,
  });

  const review = await createProposalReview({
    assignmentId: created.assignment.id,
    state,
    reviewData: {
      answers: { impact: 5 },
      rationales: {
        impact: 'Reaches the whole neighbourhood.',
        feasibility: '   ',
      },
    },
    overallComment: 'Clear budget, strong community support.',
    submittedAt:
      state === ProposalReviewState.SUBMITTED ? new Date().toISOString() : null,
  });

  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `review:${review.id}:%`));
  });

  return { ...created, reviewer, review };
}

describe('translation.translateReview', () => {
  it("translates the reviewer's rationales and overall comment for the reviewer", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { reviewer, review } = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.translation.translateReview({
      reviewId: review.id,
      targetLocale: 'es',
    });

    // Blank rationales are skipped; answers are never sent; no identity fields.
    expect(result).toEqual({
      rationales: { impact: '[ES] Reaches the whole neighbourhood.' },
      overallComment: '[ES] Clear budget, strong community support.',
      sourceLocale: 'EN',
      targetLocale: 'es',
    });
  });

  it('translates a review for a decision admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, review } = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const result = await adminCaller.translation.translateReview({
      reviewId: review.id,
      targetLocale: 'es',
    });

    expect(result.overallComment).toBe(
      '[ES] Clear budget, strong community support.',
    );
  });

  it("gates a peer reviewer on the phase's open-reviews setting", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, review } = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    // A second manager: the Reviewer role's name is keyed on the test id, and
    // the review's own reviewer already holds one on this instance.
    const peerData = new TestReviewsDataManager(
      `${task.id}-peer`,
      onTestFinished,
    );
    const peer = await peerData.createInstanceReviewerWithRole(context);
    const peerCaller = await createAuthenticatedCaller(peer.email);

    await expect(
      peerCaller.translation.translateReview({
        reviewId: review.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );

    const result = await peerCaller.translation.translateReview({
      reviewId: review.id,
      targetLocale: 'es',
    });

    expect(result.rationales.impact).toBe(
      '[ES] Reaches the whole neighbourhood.',
    );
  });

  it("rejects the proposal's author and a plain instance member", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, author, review } = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    const member = await testData.createInstanceMember(context);

    for (const email of [author.email, member.email]) {
      const caller = await createAuthenticatedCaller(email);
      await expect(
        caller.translation.translateReview({
          reviewId: review.id,
          targetLocale: 'es',
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    }

    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('does not translate a draft review', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { reviewer, review } = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
      ProposalReviewState.DRAFT,
    );

    const caller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      caller.translation.translateReview({
        reviewId: review.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeDecisionAccessTierGating('translation.translateReview', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.translation.translateReview({
          reviewId: crypto.randomUUID(),
          targetLocale: 'es',
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
        caller.translation.translateReview({
          reviewId: crypto.randomUUID(),
          targetLocale: 'es',
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
        caller.translation.translateReview({
          reviewId: crypto.randomUUID(),
          targetLocale: 'es',
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
        caller.translation.translateReview({
          reviewId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'AccessTierError' },
      });
    },
  ),
});

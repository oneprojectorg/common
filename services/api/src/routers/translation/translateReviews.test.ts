import { mockCollab } from '@op/collab/testing';
import type { RubricTemplateSchema } from '@op/common';
import { db } from '@op/db/client';
import { ProposalReviewState, contentTranslations } from '@op/db/schema';
import { createProposalReview } from '@op/test';
import { like } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import { TestReviewsDataManager } from '../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

/** The phase `createReviewAssignment` pins its assignments to by default. */
const REVIEW_PHASE_ID = 'review';

// Set a fake API key so the endpoint doesn't throw before reaching the mock
process.env.DEEPL_API_KEY = 'test-fake-key';

const mockTranslateText = vi.fn((texts: string | string[]) => {
  const arr = Array.isArray(texts) ? texts : [texts];
  const results = arr.map((t) => ({
    text: `[ES] ${t}`,
    detectedSourceLang: 'en',
  }));
  // Mirror deepl-node: a single-string input returns a single result object.
  return Array.isArray(texts) ? results : results[0];
});

vi.mock('deepl-node', () => ({
  DeepLClient: class {
    translateText = mockTranslateText;
  },
}));

const createCaller = createCallerFactory(appRouter);

const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['impact', 'notes'],
  properties: {
    impact: {
      type: 'string',
      title: 'Impact',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'high', title: 'High' },
        { const: 'low', title: 'Low' },
      ],
    },
    notes: {
      type: 'string',
      title: 'Anything else?',
      'x-format': 'long-text',
    },
  },
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * An assignment with one submitted review carrying every kind of prose a
 * reviewer can write, plus the phase's rubric. Cache rows are cleaned up after.
 */
async function createSubmittedReviewScenario(
  testData: TestReviewsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
) {
  const created = await testData.createReviewAssignment({
    title: 'Community Garden Expansion',
  });

  const { collaborationDocId } = created.proposal.proposalData as {
    collaborationDocId: string;
  };
  mockCollab.setDocResponse(collaborationDocId, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Community garden proposal content' }],
      },
    ],
  });

  await testData.setRubricTemplate(created.context, rubricTemplate);

  const review = await createProposalReview({
    assignmentId: created.assignment.id,
    state: ProposalReviewState.SUBMITTED,
    reviewData: {
      answers: { impact: 'high', notes: 'Reaches the whole neighbourhood' },
      rationales: { impact: 'Wide reach' },
    },
    overallComment: 'Strong proposal, thin budget',
    submittedAt: new Date().toISOString(),
  });

  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `review:${review.id}:%`));
  });

  return { ...created, review };
}

describe('translation.translateReviews', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('translates every kind of prose a reviewer writes', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    const caller = await createAuthenticatedCaller(created.reviewer.email);

    const result = await caller.translation.translateReviews({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      phaseId: REVIEW_PHASE_ID,
      targetLocale: 'es',
    });

    expect(result.sourceLocale).toBe('EN');
    expect(result.targetLocale).toBe('es');
    expect(result.translations[created.review.id]).toEqual({
      overallComment: '[ES] Strong proposal, thin budget',
      rationales: { impact: '[ES] Wide reach' },
      answers: { notes: '[ES] Reaches the whole neighbourhood' },
    });
  });

  // A dropdown answer is an option id: translating it would rewrite the stored
  // answer. Its label travels with the rubric instead.
  it('leaves dropdown answers alone', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    const caller = await createAuthenticatedCaller(created.reviewer.email);

    const result = await caller.translation.translateReviews({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      phaseId: REVIEW_PHASE_ID,
      targetLocale: 'es',
    });

    expect(result.translations[created.review.id]?.answers).not.toHaveProperty(
      'impact',
    );
    expect(mockTranslateText.mock.calls.flat(2).join(' ')).not.toContain(
      'high',
    );
  });

  // The reviewer's own screen shows peer reviews in an "Other reviews" tab, so
  // the same prose has to be translatable for a caller who holds REVIEW and no
  // admin — reachable only while the phase is current and its reviews are open.
  it('serves a reviewer reading a peer review in an open phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );
    const instanceId = created.context.instance.instance.id;
    await testData.setPhaseOpenReviews(instanceId, REVIEW_PHASE_ID, true);
    await testData.setCurrentPhase(instanceId, REVIEW_PHASE_ID);

    const peer = await testData.createInstanceReviewerWithRole(created.context);
    const caller = await createAuthenticatedCaller(peer.email);

    const result = await caller.translation.translateReviews({
      processInstanceId: instanceId,
      proposalId: created.proposal.id,
      phaseId: REVIEW_PHASE_ID,
      targetLocale: 'es',
    });

    expect(result.translations[created.review.id]?.overallComment).toBe(
      '[ES] Strong proposal, thin budget',
    );
  });

  it('rejects a caller who can neither review nor administer the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createSubmittedReviewScenario(
      testData,
      onTestFinished,
    );

    // The proposal's author is a decision member, not a reviewer or an admin.
    const caller = await createAuthenticatedCaller(created.author.email);

    await expect(
      caller.translation.translateReviews({
        processInstanceId: created.context.instance.instance.id,
        proposalId: created.proposal.id,
        phaseId: REVIEW_PHASE_ID,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

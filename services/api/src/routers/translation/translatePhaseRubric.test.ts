import { mockCollab } from '@op/collab/testing';
import type { RubricTemplateSchema } from '@op/common';
import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
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
  'x-field-order': ['impact'],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      description: 'How many residents does this reach?',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Low' },
        { const: 5, title: 'High', description: 'The whole city' },
      ],
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Assignment + rubric + seeded collab doc, with the cache rows cleaned up after. */
async function createRubricScenario(
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

  const instanceId = created.context.instance.instance.id;
  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `rubric:${instanceId}:%`));
  });

  return created;
}

describe('translation.translatePhaseRubric', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  // The admin review summary shows a phase's rubric without holding an
  // assignment against it, and cannot borrow a reviewer's — assignment reads
  // are self-scoped.
  it('translates a phase rubric for a caller with no assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createRubricScenario(testData, onTestFinished);

    const caller = await createAuthenticatedCaller(created.reviewer.email);

    const result = await caller.translation.translatePhaseRubric({
      processInstanceId: created.context.instance.instance.id,
      phaseId: REVIEW_PHASE_ID,
      targetLocale: 'es',
    });

    expect(result.sourceLocale).toBe('EN');
    expect(result.targetLocale).toBe('es');
    expect(result.translated).toEqual({
      'field_title:impact': '[ES] Impact',
      'field_desc:impact': '[ES] How many residents does this reach?',
      'option:impact:1': '[ES] Low',
      'option:impact:5': '[ES] High',
      'option_desc:impact:5': '[ES] The whole city',
    });
  });

  // Both addressings key the cache by phase, so the summary and the reviewer's
  // form must not pay DeepL twice for the same rubric.
  it('shares its cache with the assignment-addressed endpoint', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createRubricScenario(testData, onTestFinished);

    const caller = await createAuthenticatedCaller(created.reviewer.email);

    await caller.translation.translateRubric({
      assignmentId: created.assignment.id,
      targetLocale: 'es',
    });
    expect(mockTranslateText).toHaveBeenCalled();
    mockTranslateText.mockClear();

    const result = await caller.translation.translatePhaseRubric({
      processInstanceId: created.context.instance.instance.id,
      phaseId: REVIEW_PHASE_ID,
      targetLocale: 'es',
    });

    expect(mockTranslateText).not.toHaveBeenCalled();
    expect(result.translated).toMatchObject({
      'field_title:impact': '[ES] Impact',
    });
  });

  it('rejects a caller who can neither review nor administer the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createRubricScenario(testData, onTestFinished);

    // The proposal's author is a decision member, not a reviewer or an admin.
    const caller = await createAuthenticatedCaller(created.author.email);

    await expect(
      caller.translation.translatePhaseRubric({
        processInstanceId: created.context.instance.instance.id,
        phaseId: REVIEW_PHASE_ID,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

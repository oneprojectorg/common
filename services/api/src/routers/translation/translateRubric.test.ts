import { mockCollab } from '@op/collab/testing';
import type { RubricTemplateSchema } from '@op/common';
import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import { TestReviewsDataManager } from '../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

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
  'x-field-order': ['impact', 'feasibility'],
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
    feasibility: {
      type: 'string',
      title: 'Feasibility notes',
      'x-format': 'long-text',
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

function seedMockCollab(collaborationDocId: string) {
  mockCollab.setDocResponse(collaborationDocId, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Community garden proposal content' }],
      },
    ],
  });
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
  seedMockCollab(collaborationDocId);

  await testData.setRubricTemplate(created.context, rubricTemplate);

  const instanceId = created.context.instance.instance.id;
  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `rubric:${instanceId}:%`));
  });

  return created;
}

describe('translation.translateRubric', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('translates criterion prompts, descriptions, and option labels', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createRubricScenario(testData, onTestFinished);

    const caller = await createAuthenticatedCaller(created.reviewer.email);

    const result = await caller.translation.translateRubric({
      assignmentId: created.assignment.id,
      targetLocale: 'es',
    });

    expect(result.sourceLocale).toBe('EN');
    expect(result.targetLocale).toBe('es');
    expect(result.translated).toEqual({
      'field_title:impact': '[ES] Impact',
      'field_desc:impact': '[ES] How many residents does this reach?',
      'field_title:feasibility': '[ES] Feasibility notes',
      'option:impact:1': '[ES] Low',
      'option:impact:5': '[ES] High',
      'option_desc:impact:5': '[ES] The whole city',
    });
  });

  // Reviewers of a phase all score against the same rubric, so the content keys
  // are phase-scoped: the second reviewer's request must be a pure cache read.
  it('shares cached rubric translations across reviewers of the same phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createRubricScenario(testData, onTestFinished);

    const firstCaller = await createAuthenticatedCaller(created.reviewer.email);
    const first = await translateRubricFor(firstCaller, created.assignment.id);
    expect(mockTranslateText).toHaveBeenCalled();

    // A second reviewer, on the same phase of the same instance.
    const otherReviewer = await testData.createReviewer(created.context);
    const otherAssignment = await testData.createReviewAssignment({
      context: created.context,
      reviewer: otherReviewer,
    });
    const { collaborationDocId } = otherAssignment.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    mockTranslateText.mockClear();

    const secondCaller = await createAuthenticatedCaller(otherReviewer.email);
    const second = await translateRubricFor(
      secondCaller,
      otherAssignment.assignment.id,
    );

    expect(second.translated).toEqual(first.translated);
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it("rejects a caller who isn't the assignment's reviewer", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createRubricScenario(testData, onTestFinished);

    // The proposal's author is a decision member but not this assignment's reviewer.
    const caller = await createAuthenticatedCaller(created.author.email);

    await expect(
      caller.translation.translateRubric({
        assignmentId: created.assignment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('returns nothing to translate for an assignment with no rubric', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'No Rubric Review',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const caller = await createAuthenticatedCaller(created.reviewer.email);

    const result = await caller.translation.translateRubric({
      assignmentId: created.assignment.id,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      translated: {},
      sourceLocale: '',
      targetLocale: 'es',
    });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });
});

/** Narrow helper so the cache test reads as two identical calls. */
function translateRubricFor(
  caller: ReturnType<typeof createCaller>,
  assignmentId: string,
) {
  return caller.translation.translateRubric({
    assignmentId,
    targetLocale: 'es',
  });
}

describeDecisionAccessTierGating('translation.translateRubric', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.translation.translateRubric({
          assignmentId: crypto.randomUUID(),
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
        caller.translation.translateRubric({
          assignmentId: crypto.randomUUID(),
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
        caller.translation.translateRubric({
          assignmentId: crypto.randomUUID(),
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
        caller.translation.translateRubric({
          assignmentId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),
});

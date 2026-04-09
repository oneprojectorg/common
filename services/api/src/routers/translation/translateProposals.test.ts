import { mockCollab } from '@op/collab/testing';
import { db, eq } from '@op/db/client';
import { contentTranslations, proposals } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { TestTranslationDataManager } from '../../test/helpers/TestTranslationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

// Set a fake API key so the endpoint doesn't throw before reaching the mock
process.env.DEEPL_API_KEY = 'test-fake-key';

// Mock DeepL's translateText — prefixes each text with [ES] so we can
// distinguish mock translations from seeded cache entries ([ES-CACHED]).
const mockTranslateText = vi.fn((texts: string[]) =>
  texts.map((t) => ({
    text: `[ES] ${t}`,
    detectedSourceLang: 'en',
  })),
);

// Mock deepl-node so we never hit the real API
vi.mock('deepl-node', () => ({
  DeepLClient: class {
    translateText = mockTranslateText;
  },
}));

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe('translation.translateProposals', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('should translate title and preview for multiple proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create two proposals with different content
    const proposal1 = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Solar Panel Initiative' },
    });

    const proposal2 = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Water Purification Project' },
    });

    // Set up mock TipTap documents for both proposals
    const { collaborationDocId: docId1 } = proposal1.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(docId1, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Installing solar panels in rural areas' },
          ],
        },
      ],
    });

    const { collaborationDocId: docId2 } = proposal2.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(docId2, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Clean water for remote communities' },
          ],
        },
      ],
    });

    // Clean up translations for both proposals
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `batch:${proposal1.profileId}:%`,
          ),
        );
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `batch:${proposal2.profileId}:%`,
          ),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposals({
      profileIds: [proposal1.profileId, proposal2.profileId],
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');

    // Verify proposal 1 translations are grouped by profileId
    const t1 = result.translations[proposal1.profileId];
    expect(t1).toBeDefined();
    expect(t1?.title).toBe('[ES] Solar Panel Initiative');
    expect(t1?.preview).toMatch(/^\[ES\] .*solar panels/i);

    // Verify proposal 2 translations are grouped by profileId
    const t2 = result.translations[proposal2.profileId];
    expect(t2).toBeDefined();
    expect(t2?.title).toBe('[ES] Water Purification Project');
    expect(t2?.preview).toMatch(/^\[ES\] .*clean water/i);
  });

  it('should return cached batch translations without calling DeepL', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const translationData = new TestTranslationDataManager(onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cached Batch Proposal' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some preview content' }],
        },
      ],
    });

    // Pre-seed the title translation in the batch cache
    await translationData.seedTranslation({
      contentKey: `batch:${proposal.profileId}:title`,
      sourceText: 'Cached Batch Proposal',
      translatedText: '[ES-CACHED] Cached Batch Proposal',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `batch:${proposal.profileId}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposals({
      profileIds: [proposal.profileId],
      targetLocale: 'es',
    });

    const t = result.translations[proposal.profileId];
    expect(t).toBeDefined();

    // Title should come from cache
    expect(t?.title).toBe('[ES-CACHED] Cached Batch Proposal');

    // Preview should go through DeepL mock
    expect(t?.preview).toMatch(/^\[ES\] /);
  });

  it('should translate title but omit preview when document is empty', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a proposal with a title but an empty TipTap document
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Minimal Proposal' },
    });

    // Set up an empty TipTap document (no text content → no preview)
    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [],
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `batch:${proposal.profileId}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposals({
      profileIds: [proposal.profileId],
      targetLocale: 'es',
    });

    // Should still translate the title even with no preview
    const t = result.translations[proposal.profileId];
    expect(t).toBeDefined();
    expect(t?.title).toBe('[ES] Minimal Proposal');
    expect(t?.preview).toBeUndefined();
  });

  it('should preserve multi-category structure in batch translations', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Batch Categories Proposal' },
    });

    const proposalData = proposal.proposalData as Record<string, unknown>;
    await db
      .update(proposals)
      .set({
        proposalData: {
          ...proposalData,
          category: ['Housing', 'Transit'],
        },
      })
      .where(eq(proposals.id, proposal.id));

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Preview body' }],
        },
      ],
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `batch:${proposal.profileId}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposals({
      profileIds: [proposal.profileId],
      targetLocale: 'es',
    });

    const translatedProposal = result.translations[proposal.profileId];
    expect(translatedProposal?.category).toEqual([
      '[ES] Housing',
      '[ES] Transit',
    ]);
  });
});

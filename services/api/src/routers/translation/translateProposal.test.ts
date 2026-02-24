import { mockCollab } from '@op/collab/testing';
import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

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

describe.concurrent('translation.translateProposal', () => {
  it('should translate proposal title and body content', async ({
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

    // Create proposal with collaborationDocId (no description → keeps the doc)
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Community Garden Project' },
    });

    // Set up a mock TipTap document for the collaboration doc
    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A proposal for a garden' }],
        },
      ],
    });

    // Clean up translations inserted by translateBatch's cache-through
    const proposalId = proposal.id;
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `proposal:${proposalId}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposal({
      profileId: proposal.profileId,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      targetLocale: 'es',
      sourceLocale: 'EN',
      translated: {
        title: '[ES] Community Garden Project',
        summary:
          '[ES] <p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
      },
    });

    // Verify what was sent to DeepL (mapped from 'es' → 'ES')
    expect(mockTranslateText).toHaveBeenCalledWith(
      [
        'Community Garden Project',
        '<p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
      ],
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });

  it('should return cached title without calling DeepL for it', async ({
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
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Community Garden Project' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A proposal for a garden' }],
        },
      ],
    });

    // Pre-seed the title translation in the cache
    await translationData.seedTranslation({
      contentKey: `proposal:${proposal.id}:title`,
      sourceText: 'Community Garden Project',
      translatedText: '[ES-CACHED] Community Garden Project',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    // Clean up translations inserted by translateBatch for the body
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `proposal:${proposal.id}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposal({
      profileId: proposal.profileId,
      targetLocale: 'es',
    });

    // Title comes from cache ([ES-CACHED] prefix), body goes through DeepL ([ES] prefix)
    expect(result).toEqual({
      targetLocale: 'es',
      sourceLocale: 'EN',
      translated: {
        title: '[ES-CACHED] Community Garden Project',
        summary:
          '[ES] <p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
      },
    });

    // Only the summary (cache miss) should have been sent to DeepL
    expect(mockTranslateText).toHaveBeenCalledWith(
      ['<p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>'],
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });

  it('should skip DeepL entirely when all entries are cached', async ({
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
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Fully Cached Proposal' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Already translated body' }],
        },
      ],
    });

    const bodyHtml =
      '<p xmlns="http://www.w3.org/1999/xhtml">Already translated body</p>';

    // Pre-seed both title and summary in the cache
    await translationData.seedTranslation({
      contentKey: `proposal:${proposal.id}:title`,
      sourceText: 'Fully Cached Proposal',
      translatedText: '[ES-CACHED] Fully Cached Proposal',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    await translationData.seedTranslation({
      contentKey: `proposal:${proposal.id}:summary`,
      sourceText: bodyHtml,
      translatedText: `[ES-CACHED] ${bodyHtml}`,
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    // Clean up translations
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `proposal:${proposal.id}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposal({
      profileId: proposal.profileId,
      targetLocale: 'es',
    });

    // All values have the [ES-CACHED] prefix from the seeded cache rows.
    // If DeepL had been called, the mock would produce [ES] prefixes instead,
    // so the result itself proves the cache was used exclusively.
    expect(result).toEqual({
      targetLocale: 'es',
      sourceLocale: 'EN',
      translated: {
        title: '[ES-CACHED] Fully Cached Proposal',
        summary: `[ES-CACHED] ${bodyHtml}`,
      },
    });
  });

  it('should translate legacy proposals with HTML description (no TipTap doc)', async ({
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

    // Create a legacy proposal with description instead of collaborationDocId
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Legacy Proposal',
        description: '<p>Old-style HTML content</p>',
      },
    });

    // Clean up translations
    const proposalId = proposal.id;
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `proposal:${proposalId}:%`),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateProposal({
      profileId: proposal.profileId,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      targetLocale: 'es',
      sourceLocale: 'EN',
      translated: {
        title: '[ES] Legacy Proposal',
        default: '[ES] <p>Old-style HTML content</p>',
      },
    });

    expect(mockTranslateText).toHaveBeenCalledWith(
      ['Legacy Proposal', '<p>Old-style HTML content</p>'],
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });
});

import { mockCollab, textFragment } from '@op/collab/testing';
import { db, eq } from '@op/db/client';
import { contentTranslations, ProposalStatus, proposals } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { TestTranslationDataManager } from '../../test/helpers/TestTranslationDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

// Set a fake API key so the endpoint doesn't throw before reaching the mock
process.env.DEEPL_API_KEY = 'test-fake-key';

// Mock DeepL's translateText — prefixes each text with [ES] so we can
// distinguish mock translations from seeded cache entries ([ES-CACHED]).
//
// It also mirrors the behaviour this file exists to pin: with tagHandling on,
// DeepL parses the input as a document, so a bare string comes back wrapped in
// a namespaced <p>. Plain fields must therefore be sent without tagHandling.
const mockTranslateText = vi.fn(
  (
    texts: string | string[],
    _sourceLang?: unknown,
    _targetLang?: unknown,
    options?: { tagHandling?: string },
  ) => {
    const arr = Array.isArray(texts) ? texts : [texts];
    const results = arr.map((t) => {
      const looksLikeMarkup = /^\s*</.test(t);
      const translated =
        options?.tagHandling === 'html' && !looksLikeMarkup
          ? `<p xmlns="http://www.w3.org/1999/xhtml">[ES] ${t}</p>`
          : `[ES] ${t}`;

      return { text: translated, detectedSourceLang: 'en' };
    });

    // Mirror deepl-node: a single-string input returns a single result object.
    return Array.isArray(texts) ? results : results[0];
  },
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

// openProcedure admits every tier past the gate; service-layer fail-closed is
// covered by the describe block below.
describeAccessTierGating('translation.translateProposal', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateProposal({
          profileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateProposal({
          profileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateProposal({
          profileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateProposal({
          profileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),
});

describe('translation.translateProposal', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('should let a no-JWT visitor translate a proposal on a public decision', async ({
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

    // Submitted (not draft): a draft is visible only to proposal-level
    // grantees, so a public visitor must read a submitted proposal.
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Public Garden Project' },
      status: ProposalStatus.SUBMITTED,
    });

    // Open the decision to visitors: GLOBAL_USER_PUBLIC gets the Public role
    // (decisions READ), which a no-JWT caller resolves to via the sentinel.
    await testData.makeDecisionPublic(instance.profileId);

    const proposalId = proposal.id;
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `proposal:${proposalId}:%`),
        );
    });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    const result = await visitorCaller.translation.translateProposal({
      profileId: proposal.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.translated.title).toBe('[ES] Public Garden Project');
  });

  it('should reject a no-JWT visitor on a non-public proposal', async ({
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
      proposalData: { title: 'Private Proposal' },
    });

    // No make-public grant: GLOBAL_USER_PUBLIC has no decisions:READ on this
    // decision, so the service must fail closed past the open tier gate.
    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translateProposal({
        profileId: proposal.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('should translate proposal title and body content', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Create proposal with collaborationDocId (no description → keeps the doc)
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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
        default:
          '[ES] <p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
      },
    });

    // The title is a bare string. If it were sent with tagHandling, DeepL
    // would hand back `<p xmlns=…>[ES] Community Garden Project</p>` and the
    // proposal header would render that markup as literal text.
    expect(result.translated.title).toBe('[ES] Community Garden Project');
    expect(result.translated.title).not.toContain('<p');

    // Verify what was sent to DeepL (mapped from 'es' → 'ES'). DeepL is called
    // once per text so batch size can't exceed its per-request cap.
    expect(mockTranslateText).toHaveBeenCalledWith(
      'Community Garden Project',
      null,
      'ES',
      // No options at all — asserting `objectContaining({ tagHandling:
      // undefined })` would pass on a request that never omitted the key.
      {},
    );
    expect(mockTranslateText).toHaveBeenCalledWith(
      '<p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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
      format: 'text',
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
        default:
          '[ES] <p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
      },
    });

    // Only the body (cache miss) should have been sent to DeepL
    expect(mockTranslateText).toHaveBeenCalledWith(
      '<p xmlns="http://www.w3.org/1999/xhtml">A proposal for a garden</p>',
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    // Pre-seed both title and body in the cache
    await translationData.seedTranslation({
      contentKey: `proposal:${proposal.id}:title`,
      sourceText: 'Fully Cached Proposal',
      translatedText: '[ES-CACHED] Fully Cached Proposal',
      sourceLocale: 'EN',
      targetLocale: 'ES',
      format: 'text',
    });

    await translationData.seedTranslation({
      contentKey: `proposal:${proposal.id}:default`,
      sourceText:
        '<p xmlns="http://www.w3.org/1999/xhtml">Already translated body</p>',
      translatedText:
        '[ES-CACHED] <p xmlns="http://www.w3.org/1999/xhtml">Already translated body</p>',
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
        default:
          '[ES-CACHED] <p xmlns="http://www.w3.org/1999/xhtml">Already translated body</p>',
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

    const instance = setup.instance;

    // Create a legacy proposal with description instead of collaborationDocId
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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
      'Legacy Proposal',
      null,
      'ES',
      // No options at all — asserting `objectContaining({ tagHandling:
      // undefined })` would pass on a request that never omitted the key.
      {},
    );
    expect(mockTranslateText).toHaveBeenCalledWith(
      '<p>Old-style HTML content</p>',
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
  });

  it('should translate template field titles, descriptions, and dropdown options', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const proposalTemplate = {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          title: 'Project Category',
          description: 'Select the category for your proposal',
          'x-format': 'select',
          oneOf: [
            { const: 'infrastructure', title: 'Infrastructure' },
            { const: 'education', title: 'Education' },
            { const: 'health', title: 'Health Services' },
          ],
        },
        summary: {
          type: 'string',
          title: 'Executive Summary',
          description: 'Brief overview of your proposal',
          'x-format': 'textarea',
        },
      },
    };

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate,
    });

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Template Fields Test' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body content' }],
        },
      ],
    });

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

    // Verify template field titles are translated
    expect(result.translated['field_title:category']).toBe(
      '[ES] Project Category',
    );
    expect(result.translated['field_title:summary']).toBe(
      '[ES] Executive Summary',
    );

    // Verify template field descriptions are translated
    expect(result.translated['field_desc:category']).toBe(
      '[ES] Select the category for your proposal',
    );
    expect(result.translated['field_desc:summary']).toBe(
      '[ES] Brief overview of your proposal',
    );

    // Verify dropdown option labels are translated
    expect(result.translated['option:category:infrastructure']).toBe(
      '[ES] Infrastructure',
    );
    expect(result.translated['option:category:education']).toBe(
      '[ES] Education',
    );
    expect(result.translated['option:category:health']).toBe(
      '[ES] Health Services',
    );

    // Verify standard fields are still present
    expect(result.translated['title']).toBe('[ES] Template Fields Test');
    expect(result.sourceLocale).toBe('EN');
    expect(result.targetLocale).toBe('es');
  });

  it('keeps the plain-text title when a colliding title document fragment exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // A template that exposes `title` as a field means `title` also comes back
    // as a TipTap document fragment, whose generated HTML carries the
    // `<p xmlns="…xhtml">` wrapper. That fragment shares the plain title's
    // content key, so before the fix it clobbered the plain-text translation
    // and leaked the tag into the title (ONE-395).
    const proposalTemplate = {
      type: 'object',
      properties: {
        title: { type: 'string', title: 'Proposal title', 'x-format': 'text' },
        summary: {
          type: 'string',
          title: 'Summary',
          'x-format': 'textarea',
        },
      },
    };

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Playground made of ice cream' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocFragmentResponses(collaborationDocId, {
      title: textFragment('Playground made of ice cream'),
      summary: textFragment('There are no playgrounds made of ice cream'),
    });

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

    // Title stays plain text — the document fragment's HTML wrapper never leaks.
    expect(result.translated.title).toBe('[ES] Playground made of ice cream');
    expect(String(result.translated.title)).not.toContain('xmlns');
    // The rich-text body fragment still comes through as HTML.
    expect(String(result.translated.summary)).toContain(
      'There are no playgrounds made of ice cream',
    );
  });

  it('should preserve multi-category structure when translating categories', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Multi Category Proposal',
      },
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
          content: [{ type: 'text', text: 'Body content' }],
        },
      ],
    });

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

    expect(result.translated.category).toEqual([
      '[ES] Housing',
      '[ES] Transit',
    ]);
  });

  it('should use cached template field translations without calling DeepL', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const translationData = new TestTranslationDataManager(onTestFinished);

    const proposalTemplate = {
      type: 'object',
      properties: {
        region: {
          type: 'string',
          title: 'Target Region',
          'x-format': 'text',
        },
      },
    };

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate,
    });

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cached Template Test' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some body' }],
        },
      ],
    });

    // Pre-seed the field title translation in the cache
    await translationData.seedTranslation({
      contentKey: `proposal:${proposal.id}:field_title:region`,
      sourceText: 'Target Region',
      translatedText: '[ES-CACHED] Target Region',
      sourceLocale: 'EN',
      targetLocale: 'ES',
      format: 'text',
    });

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

    // Field title should come from cache
    expect(result.translated['field_title:region']).toBe(
      '[ES-CACHED] Target Region',
    );

    // Title and body should go through DeepL mock
    expect(result.translated['title']).toBe('[ES] Cached Template Test');
  });
});

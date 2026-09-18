import { mockCollab } from '@op/collab/testing';
import { db, eq } from '@op/db/client';
import { contentTranslations, proposals } from '@op/db/schema';
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
const mockTranslateText = vi.fn((texts: string | string[]) => {
  const arr = Array.isArray(texts) ? texts : [texts];
  const results = arr.map((t) => ({
    text: `[ES] ${t}`,
    detectedSourceLang: 'en',
  }));
  // Mirror deepl-node: a single-string input returns a single result object.
  return Array.isArray(texts) ? results : results[0];
});

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
describeAccessTierGating('translation.translateProposals', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateProposals({
          profileIds: ['00000000-0000-0000-0000-000000000000'],
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
        caller.translation.translateProposals({
          profileIds: ['00000000-0000-0000-0000-000000000000'],
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
        caller.translation.translateProposals({
          profileIds: ['00000000-0000-0000-0000-000000000000'],
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
        caller.translation.translateProposals({
          profileIds: ['00000000-0000-0000-0000-000000000000'],
          targetLocale: 'en',
        }),
      );
    },
  ),
});

describe('translation.translateProposals', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('should let a no-JWT visitor translate proposals on a public decision', async ({
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
      proposalData: { title: 'Public Batch Proposal' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };
    mockCollab.setDocResponse(collaborationDocId, {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Public preview body' }],
        },
      ],
    });

    // Open the decision to visitors: GLOBAL_USER_PUBLIC gets the Public role
    // (decisions READ), which a no-JWT caller resolves to via the sentinel.
    await testData.makeDecisionPublic(instance.profileId);

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `batch:${proposal.profileId}:%`),
        );
    });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    const result = await visitorCaller.translation.translateProposals({
      profileIds: [proposal.profileId],
      targetLocale: 'es',
    });

    const t = result.translations[proposal.profileId];
    expect(t?.title).toBe('[ES] Public Batch Proposal');
  });

  it('should reject a no-JWT visitor on non-public proposals', async ({
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
      proposalData: { title: 'Private Batch Proposal' },
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(contentTranslations.contentKey, `batch:${proposal.profileId}:%`),
        );
    });

    // No make-public grant: GLOBAL_USER_PUBLIC has no decisions:READ on this
    // decision, so the service must fail closed past the open tier gate.
    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translateProposals({
        profileIds: [proposal.profileId],
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('should fail closed when a batch spans a non-public decision', async ({
    task,
    onTestFinished,
  }) => {
    // Two independent decisions (separate processes) — translateProposals
    // asserts once per unique processId, so the private one must be its own
    // process, not a second instance of the public one.
    const publicData = new TestDecisionsDataManager(task.id, onTestFinished);
    const privateData = new TestDecisionsDataManager(task.id, onTestFinished);

    const publicSetup = await publicData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const privateSetup = await privateData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const publicInstance = publicSetup.instances[0];
    const privateInstance = privateSetup.instances[0];
    if (!publicInstance || !privateInstance) {
      throw new Error('Expected an instance in each setup');
    }

    const publicProposal = await publicData.createProposal({
      userEmail: publicSetup.userEmail,
      processInstanceId: publicInstance.instance.id,
      proposalData: { title: 'Readable Proposal' },
    });
    const privateProposal = await privateData.createProposal({
      userEmail: privateSetup.userEmail,
      processInstanceId: privateInstance.instance.id,
      proposalData: { title: 'Off-limits Proposal' },
    });

    // Only the first decision is public — the batch must still fail closed
    // because the second decision's assert rejects the visitor.
    await publicData.makeDecisionPublic(publicInstance.profileId);

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `batch:${publicProposal.profileId}:%`,
          ),
        );
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `batch:${privateProposal.profileId}:%`,
          ),
        );
    });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translateProposals({
        profileIds: [publicProposal.profileId, privateProposal.profileId],
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
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

    const instance = setup.instance;

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

    const instance = setup.instance;

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
      format: 'text',
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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

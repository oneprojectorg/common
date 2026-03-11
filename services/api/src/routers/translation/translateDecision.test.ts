import { db } from '@op/db/client';
import { contentTranslations, processInstances } from '@op/db/schema';
import { eq, like } from 'drizzle-orm';
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

describe.concurrent('translation.translateDecision', () => {
  it('should translate headline, phase description, and phase names', async ({
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

    // Patch instanceData to add translatable phase content
    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const phases = instanceData.phases as Array<Record<string, unknown>>;
    phases[0] = {
      ...phases[0],
      headline: 'Submit Your Ideas',
      description: 'Tell us about your proposal',
      name: 'Idea Collection',
    };
    phases[1] = { ...phases[1], name: 'Final Review' };

    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases } })
      .where(eq(processInstances.id, instance.instance.id));

    // Clean up translations created by the test
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `decision:${instance.profileId}:%`,
          ),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');
    expect(result.translated.headline).toBe('[ES] Submit Your Ideas');
    expect(result.translated.phaseDescription).toBe(
      '[ES] Tell us about your proposal',
    );
    expect(result.translated['phase:initial:name']).toBe(
      '[ES] Idea Collection',
    );
    expect(result.translated['phase:final:name']).toBe('[ES] Final Review');
  });

  it('should render additionalInfo TipTap JSON to HTML before translating', async ({
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

    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const phases = instanceData.phases as Array<Record<string, unknown>>;
    const tiptapJson = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Learn more about this process' }],
        },
      ],
    });
    phases[0] = { ...phases[0], additionalInfo: tiptapJson };

    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases } })
      .where(eq(processInstances.id, instance.instance.id));

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `decision:${instance.profileId}:%`,
          ),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });

    // DeepL should have received HTML, not raw TipTap JSON
    expect(mockTranslateText).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('<p')]),
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
    expect(result.translated.additionalInfo).toContain('[ES]');
    expect(result.translated.additionalInfo).toContain('<p');
  });

  it('should return empty translated when instance has no translatable content', async ({
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

    // Remove phase names from instanceData to produce an instance with no translatable content
    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const phases = (instanceData.phases as Array<Record<string, unknown>>).map(
      ({
        name: _name,
        headline: _h,
        description: _d,
        additionalInfo: _a,
        ...rest
      }) => rest,
    );

    // Also null out the processInstances.description column (separate from instanceData)
    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases }, description: null })
      .where(eq(processInstances.id, instance.instance.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translated).toEqual({});
    expect(result.sourceLocale).toBe('');
  });

  it('should use cached translations without calling DeepL for them', async ({
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

    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const phases = instanceData.phases as Array<Record<string, unknown>>;
    phases[0] = {
      ...phases[0],
      headline: 'Share Your Vision',
      name: 'Ideation',
    };

    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases } })
      .where(eq(processInstances.id, instance.instance.id));

    // Pre-seed the headline translation in cache
    await translationData.seedTranslation({
      contentKey: `decision:${instance.profileId}:headline`,
      sourceText: 'Share Your Vision',
      translatedText: '[ES-CACHED] Share Your Vision',
      sourceLocale: 'EN',
      targetLocale: 'ES',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `decision:${instance.profileId}:%`,
          ),
        );
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });

    // Headline comes from cache ([ES-CACHED]), phase name goes through DeepL ([ES])
    expect(result.translated.headline).toBe('[ES-CACHED] Share Your Vision');
    expect(result.translated['phase:initial:name']).toBe('[ES] Ideation');
  });

  it('should throw NotFoundError for non-existent decisionProfileId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.translation.translateDecision({
        decisionProfileId: '00000000-0000-0000-0000-000000000000',
        targetLocale: 'es',
      }),
    ).rejects.toThrow();
  });

  it('should throw UnauthorizedError for user without decision access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create owner with a decision instance (no grantAccess for other user)
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Clean up any cache entries written before auth fails (runTranslateBatch runs
    // in parallel with the auth check and may write rows before rejection)
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `decision:${instance.profileId}:%`,
          ),
        );
    });

    // Create a separate user from a completely different org — no access to this decision
    const otherData = new TestDecisionsDataManager(task.id, onTestFinished);
    const otherSetup = await otherData.createDecisionSetup({
      instanceCount: 0,
    });
    const otherCaller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      otherCaller.translation.translateDecision({
        decisionProfileId: instance.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toThrow();
  });

  it('should allow org member without direct profile access via org fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false, // owner gets profile access, not the member
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Patch instance with some content so we get a non-empty result
    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const phases = instanceData.phases as Array<Record<string, unknown>>;
    phases[0] = { ...phases[0], headline: 'Org Member Test' };

    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases } })
      .where(eq(processInstances.id, instance.instance.id));

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(
          like(
            contentTranslations.contentKey,
            `decision:${instance.profileId}:%`,
          ),
        );
    });

    // Create a member of the same org (no direct profile access)
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [], // no profile access granted
    });

    const memberCaller = await createAuthenticatedCaller(member.email);

    // Should succeed via org-level fallback
    const result = await memberCaller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translated.headline).toBe('[ES] Org Member Test');
  });
});

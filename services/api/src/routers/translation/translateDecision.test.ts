import { db } from '@op/db/client';
import { contentTranslations, processInstances } from '@op/db/schema';
import { eq, like } from 'drizzle-orm';
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
describeAccessTierGating('translation.translateDecision', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateDecision({
          decisionProfileId: '00000000-0000-0000-0000-000000000000',
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
        caller.translation.translateDecision({
          decisionProfileId: '00000000-0000-0000-0000-000000000000',
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
        caller.translation.translateDecision({
          decisionProfileId: '00000000-0000-0000-0000-000000000000',
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
        caller.translation.translateDecision({
          decisionProfileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),
});

describe('translation.translateDecision', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('should translate headline, phase description, and phase names', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Patch instanceData to add translatable phase content
    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
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
    expect(result.headline).toBe('[ES] Submit Your Ideas');
    expect(result.phaseDescription).toBe('[ES] Tell us about your proposal');
    expect(result.phases.find((p) => p.id === 'initial')?.name).toBe(
      '[ES] Idea Collection',
    );
    expect(result.phases.find((p) => p.id === 'final')?.name).toBe(
      '[ES] Final Review',
    );
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

    const instance = setup.instance;

    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
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
      expect.stringContaining('<p'),
      null,
      'ES',
      expect.objectContaining({ tagHandling: 'html' }),
    );
    expect(result.additionalInfo).toContain('[ES]');
    expect(result.additionalInfo).toContain('<p');
  });

  it('should translate authored overview headline, description, and body', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const overviewBody = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'About this decision' }],
        },
      ],
    };

    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          overview: {
            headline: 'Welcome to the Process',
            description: 'A short overview blurb',
            body: overviewBody,
          },
        },
      })
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

    expect(result.overviewHeadline).toBe('[ES] Welcome to the Process');
    expect(result.overviewDescription).toBe('[ES] A short overview blurb');
    // Body is a TipTap JSON doc rendered to HTML before translating.
    expect(result.overviewBody).toContain('[ES]');
    expect(result.overviewBody).toContain('<p');
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

    const instance = setup.instance;

    // Remove phase names from instanceData to produce an instance with no translatable content
    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
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

    expect(result.headline).toBeUndefined();
    expect(result.phaseDescription).toBeUndefined();
    expect(result.additionalInfo).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.phases).toEqual([]);
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

    const instance = setup.instance;

    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
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
      format: 'text',
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
    expect(result.headline).toBe('[ES-CACHED] Share Your Vision');
    expect(result.phases.find((p) => p.id === 'initial')?.name).toBe(
      '[ES] Ideation',
    );
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

  it('should let a no-JWT visitor translate a public decision', async ({
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

    // Give the decision some translatable content.
    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });
    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    const phases = instanceData.phases as Array<Record<string, unknown>>;
    phases[0] = { ...phases[0], headline: 'Public Headline' };

    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases } })
      .where(eq(processInstances.id, instance.instance.id));

    // Open the decision to visitors: GLOBAL_USER_PUBLIC gets the Public role
    // (decisions READ), which a no-JWT caller resolves to via the sentinel.
    await testData.makeDecisionPublic(instance.profileId);

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

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    const result = await visitorCaller.translation.translateDecision({
      decisionProfileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.headline).toBe('[ES] Public Headline');
  });

  it('should reject a logged-out caller without decisions:READ on the decision', async ({
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

    // Clean up any cache entries written before auth fails (runTranslateBatch
    // runs in parallel with the auth check and may write rows before rejection).
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

    // Past the gate, but the service must fail closed — the public sentinel
    // has no decisions:READ grant on this decision.
    const loggedOutCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      loggedOutCaller.translation.translateDecision({
        decisionProfileId: instance.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
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

    const instance = setup.instance;

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

    const instance = setup.instance;

    // Patch instance with some content so we get a non-empty result
    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
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

    expect(result.headline).toBe('[ES] Org Member Test');
  });
});

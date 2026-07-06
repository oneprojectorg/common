import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { registerResourcesCleanup } from '../../test/helpers/resourcesTestUtils';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

// Set a fake API key so the endpoint doesn't throw before reaching the mock.
process.env.DEEPL_API_KEY = 'test-fake-key';

const mockTranslateText = vi.fn((texts: string[]) =>
  texts.map((t) => ({
    text: `[ES] ${t}`,
    detectedSourceLang: 'en',
  })),
);

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
describeAccessTierGating('translation.translateResources', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateResources({
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
        caller.translation.translateResources({
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
        caller.translation.translateResources({
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
        caller.translation.translateResources({
          profileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),
});

describe('translation.translateResources', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('translates title and description for every resource on the decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    registerResourcesCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const first = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'City of Columbus, Ohio',
      description: 'The official Columbus website',
      linkUrl: 'https://columbus.gov',
    });
    const second = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Onboarding packet',
      linkUrl: 'https://example.com/onboarding',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `resource:${first.id}:%`));
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `resource:${second.id}:%`));
    });

    const result = await adminCaller.translation.translateResources({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');
    expect(result.translations[first.id]?.title).toBe(
      '[ES] City of Columbus, Ohio',
    );
    expect(result.translations[first.id]?.description).toBe(
      '[ES] The official Columbus website',
    );
    expect(result.translations[second.id]?.title).toBe(
      '[ES] Onboarding packet',
    );
    expect(result.translations[second.id]?.description).toBeUndefined();
  });

  it('routes Somali through OpenL instead of DeepL', async ({
    task,
    onTestFinished,
  }) => {
    process.env.OPENL_RAPIDAPI_KEY = 'test-openl-key';

    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    registerResourcesCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const link = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'City Hall',
      description: 'Local government office',
      linkUrl: 'https://example.com/city-hall',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `resource:${link.id}:%`));
    });

    // Only intercept the OpenL endpoint; delegate every other request (e.g.
    // Supabase auth used to resolve the caller's roles) to the real fetch, or
    // the access check would fail before translation runs.
    const realFetch = globalThis.fetch;
    const openlRequests: Array<{ url: string; init: RequestInit }> = [];
    const mockFetch = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        if (!url.includes('openl-translate.p.rapidapi.com')) {
          return realFetch(input, init);
        }
        openlRequests.push({ url, init: init ?? {} });
        const body = JSON.parse(String(init?.body));
        return Promise.resolve(
          Response.json({
            translatedTexts: (body.text as string[]).map((t) => `[SO] ${t}`),
          }),
        );
      },
    );
    vi.stubGlobal('fetch', mockFetch);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });

    const result = await adminCaller.translation.translateResources({
      profileId: instance.profileId,
      targetLocale: 'so',
    });

    expect(result.targetLocale).toBe('so');
    expect(result.translations[link.id]?.title).toBe('[SO] City Hall');
    expect(result.translations[link.id]?.description).toBe(
      '[SO] Local government office',
    );

    // DeepL must never be called for Somali.
    expect(mockTranslateText).not.toHaveBeenCalled();

    // OpenL was called with the RapidAPI key and the Somali target code.
    expect(openlRequests).toHaveLength(1);
    const openlRequest = openlRequests[0];
    expect(openlRequest?.init.method).toBe('POST');
    expect(openlRequest?.init.headers).toMatchObject({
      'x-rapidapi-key': 'test-openl-key',
      'x-rapidapi-host': 'openl-translate.p.rapidapi.com',
    });
    const sentBody = JSON.parse(String(openlRequest?.init.body));
    expect(sentBody.target_lang).toBe('so');
  });

  it('returns an empty result when the decision has no resources', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.translation.translateResources({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translations).toEqual({});
  });

  it('rejects a no-JWT visitor on a non-public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    registerResourcesCleanup(onTestFinished, [instance.profileId]);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Private resource',
      linkUrl: 'https://example.com/private',
    });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translateResources({
        profileId: instance.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

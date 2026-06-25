import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import { like } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { setupInstance } from '../../test/helpers/resourcesTestUtils';
import { createTestContextWithSession } from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

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

  it('should translate the title and description of every resource on a profile', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const link = await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'City of Columbus, Ohio',
      description: 'The official Columbus website',
      linkUrl: 'https://columbus.gov',
    });
    const titleOnly = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: link.collectionId },
      title: 'Budget Overview',
      linkUrl: 'https://example.com/budget',
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `resource:%`));
    });

    const result = await adminCaller.translation.translateResources({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');
    expect(result.translations[link.id]).toEqual({
      title: '[ES] City of Columbus, Ohio',
      description: '[ES] The official Columbus website',
    });
    // Resources without a description only contribute the title.
    expect(result.translations[titleOnly.id]).toEqual({
      title: '[ES] Budget Overview',
    });
  });

  it('should return an empty result when the profile has no resources', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const result = await adminCaller.translation.translateResources({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translations).toEqual({});
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('should reject callers without decisions:READ on the parent profile', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Private link',
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
      cause: { name: 'AccessControlException' },
    });
  });
});

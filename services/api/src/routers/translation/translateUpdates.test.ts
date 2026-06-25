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
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describeAccessTierGating('translation.translateUpdates', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translateUpdates({
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
        caller.translation.translateUpdates({
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
        caller.translation.translateUpdates({
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
        caller.translation.translateUpdates({
          decisionProfileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),
});

describe('translation.translateUpdates', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('rejects an out-of-network visitor on a non-public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translateUpdates({
        decisionProfileId: setup.instance.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessControlException' },
    });
  });

  it('returns an empty map when the decision has no top-level updates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.translation.translateUpdates({
      decisionProfileId: setup.instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translations).toEqual({});
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('translates the content of every top-level update keyed by post id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const first = await caller.posts.createPost({
      content: 'First update',
      profileId: setup.instance.profileId,
    });
    const second = await caller.posts.createPost({
      content: 'Second update',
      profileId: setup.instance.profileId,
    });
    // A reply should NOT show up — only top-level posts get translated.
    await caller.posts.createPost({
      content: 'Reply on first',
      parentPostId: first.id,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `update:%`));
    });

    const result = await caller.translation.translateUpdates({
      decisionProfileId: setup.instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');
    expect(result.translations[first.id]?.content).toBe('[ES] First update');
    expect(result.translations[second.id]?.content).toBe('[ES] Second update');
    expect(Object.keys(result.translations)).toHaveLength(2);
  });
});

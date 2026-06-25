import { createPostOnProfile } from '@op/common';
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

describeAccessTierGating('translation.translatePosts', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePosts({
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
        caller.translation.translatePosts({
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
        caller.translation.translatePosts({
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
        caller.translation.translatePosts({
          profileId: '00000000-0000-0000-0000-000000000000',
          targetLocale: 'en',
        }),
      );
    },
  ),
});

describe('translation.translatePosts', () => {
  beforeEach(() => {
    mockTranslateText.mockClear();
  });

  it('should translate every top-level post on a decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const post1 = await createPostOnProfile({
      content: 'Welcome to the decision',
      targetProfileId: instance.profileId,
      authUserId: setup.user.id,
    });
    const post2 = await createPostOnProfile({
      content: 'Proposals close Friday',
      targetProfileId: instance.profileId,
      authUserId: setup.user.id,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:%`));
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');
    expect(result.translations[post1.id]?.content).toBe(
      '[ES] Welcome to the decision',
    );
    expect(result.translations[post2.id]?.content).toBe(
      '[ES] Proposals close Friday',
    );
  });

  it('should not translate comments — only top-level posts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const parent = await createPostOnProfile({
      content: 'Parent announcement',
      targetProfileId: instance.profileId,
      authUserId: setup.user.id,
    });
    const reply = await createPostOnProfile({
      content: 'Nested reply',
      parentPostId: parent.id,
      targetProfileId: instance.profileId,
      authUserId: setup.user.id,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:%`));
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translations[parent.id]?.content).toBe(
      '[ES] Parent announcement',
    );
    expect(result.translations[reply.id]).toBeUndefined();
  });

  it('should return an empty result when the profile has no posts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translatePosts({
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
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    await createPostOnProfile({
      content: 'Private update',
      targetProfileId: instance.profileId,
      authUserId: setup.user.id,
    });

    // No make-public grant: a no-JWT visitor must fail closed past the gate.
    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translatePosts({
        profileId: instance.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessControlException' },
    });
  });
});

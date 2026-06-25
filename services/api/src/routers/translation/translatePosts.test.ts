import { db } from '@op/db/client';
import { contentTranslations, moderationFlags } from '@op/db/schema';
import {
  ModerationFlagStatus,
  ModerationItemType,
  ModerationSource,
} from '@op/db/schema';
import { eq, like } from 'drizzle-orm';
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

  it('translates the content of every top-level update on the decision profile', async ({
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

    const first = await adminCaller.posts.createPost({
      content: 'Hello everyone, real and anonymous users!',
      profileId: instance.profileId,
    });
    const second = await adminCaller.posts.createPost({
      content: 'A second update from the team.',
      profileId: instance.profileId,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${first.id}:%`));
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${second.id}:%`));
    });

    const result = await adminCaller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.targetLocale).toBe('es');
    expect(result.sourceLocale).toBe('EN');
    expect(result.translations[first.id]?.content).toBe(
      '[ES] Hello everyone, real and anonymous users!',
    );
    expect(result.translations[second.id]?.content).toBe(
      '[ES] A second update from the team.',
    );
  });

  it('lets a no-JWT visitor translate updates on a public decision', async ({
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
    const update = await adminCaller.posts.createPost({
      content: 'Public update from the team.',
      profileId: instance.profileId,
    });

    await testData.makeDecisionPublic(instance.profileId);

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${update.id}:%`));
    });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    const result = await visitorCaller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translations[update.id]?.content).toBe(
      '[ES] Public update from the team.',
    );
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

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.posts.createPost({
      content: 'Members-only update.',
      profileId: instance.profileId,
    });

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

  it('excludes comment replies from the translated set', async ({
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
    const update = await adminCaller.posts.createPost({
      content: 'Top-level update.',
      profileId: instance.profileId,
    });
    const reply = await adminCaller.posts.createPost({
      content: 'Reply on the update.',
      parentPostId: update.id,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${update.id}:%`));
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${reply.id}:%`));
    });

    const result = await adminCaller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });

    expect(result.translations[update.id]?.content).toBe(
      '[ES] Top-level update.',
    );
    expect(result.translations[reply.id]).toBeUndefined();
  });

  it('hides a flagged post from a non-admin non-author caller via the moderation filter', async ({
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
    const visible = await adminCaller.posts.createPost({
      content: 'Visible update.',
      profileId: instance.profileId,
    });
    const flagged = await adminCaller.posts.createPost({
      content: 'Flagged update, hidden from non-admins.',
      profileId: instance.profileId,
    });

    // Open an automated flag on the second post. Matches how
    // moderationVisibility.test.ts seeds flagged content.
    await db.insert(moderationFlags).values({
      itemType: ModerationItemType.POST,
      itemId: flagged.id,
      status: ModerationFlagStatus.FLAGGED,
      source: ModerationSource.AUTOMATED,
      reason: 'translatePosts test',
    });

    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, flagged.id));
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${visible.id}:%`));
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${flagged.id}:%`));
    });

    // A member (non-admin, non-author) running translate must NOT see the
    // flagged post's content in the response — same gate as listProfilePosts.
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const memberResult = await memberCaller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });
    expect(memberResult.translations[visible.id]?.content).toBe(
      '[ES] Visible update.',
    );
    expect(memberResult.translations[flagged.id]).toBeUndefined();

    // Admins skip the moderation filter and still see the flagged content,
    // so an admin who hits translate gets every update — including flagged.
    const adminResult = await adminCaller.translation.translatePosts({
      profileId: instance.profileId,
      targetLocale: 'es',
    });
    expect(adminResult.translations[flagged.id]?.content).toBe(
      '[ES] Flagged update, hidden from non-admins.',
    );
  });

  it('rejects translating posts on a non-decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.translation.translatePosts({
        profileId: setup.organization.profileId,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

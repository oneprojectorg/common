import { createPostOnProfile } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ModerationFlagStatus,
  ModerationItemType,
  ModerationSource,
  ProposalStatus,
  contentTranslations,
  moderationFlags,
  posts,
} from '@op/db/schema';
import { eq, inArray, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createNonNetworkUser } from '../../test/helpers/nonNetworkUser';
import { mockTranslateText } from '../../test/mocks/deepl';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** A decision with one proposal carrying one comment by the decision admin. */
async function createProposalComment(
  testData: TestDecisionsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
  content: string,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: setup.instance.instance.id,
    proposalData: { title: 'Community Garden Expansion' },
    status: ProposalStatus.SUBMITTED,
  });

  const comment = await createPostOnProfile({
    content,
    targetProfileId: proposal.profileId,
    authUserId: setup.user.id,
  });

  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `post:${comment.id}:%`));
  });

  return { setup, proposal, comment };
}

async function createFeedPost(
  testData: TestDecisionsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
  content: string,
) {
  const setup = await testData.createDecisionSetup({ instanceCount: 0 });
  const adminCaller = await createAuthenticatedCaller(setup.userEmail);
  const feedPost = await adminCaller.organization.createPost({
    id: setup.organization.id,
    content,
  });

  // Feed posts have no author profile, so the data manager can't cascade-delete them.
  onTestFinished(async () => {
    await db.delete(posts).where(eq(posts.id, feedPost.id));
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `post:${feedPost.id}:%`));
  });

  return { setup, adminCaller, feedPost };
}

const createNonNetworkCaller = async (testData: TestDecisionsDataManager) =>
  createAuthenticatedCaller(await createNonNetworkUser(testData));

async function flagPost(
  onTestFinished: (fn: () => Promise<void>) => void,
  postId: string,
) {
  await db.insert(moderationFlags).values({
    itemType: ModerationItemType.POST,
    itemId: postId,
    status: ModerationFlagStatus.FLAGGED,
    source: ModerationSource.AUTOMATED,
    reason: 'translatePost test',
  });
  onTestFinished(async () => {
    await db.delete(moderationFlags).where(eq(moderationFlags.itemId, postId));
  });
}

describe('translation.translatePost', () => {
  it("translates a proposal comment's content", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Love this idea for the neighbourhood.',
    );

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translatePost({
      postId: comment.id,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      content: '[ES] Love this idea for the neighbourhood.',
      sourceLocale: 'EN',
      targetLocale: 'es',
    });

    // Cached per post, so a second reader's click is served from the cache.
    const cached = await db.query.contentTranslations.findFirst({
      where: { contentKey: `post:${comment.id}:content` },
    });
    expect(cached).toBeDefined();
  });

  it('translates a decision update for a member with READ access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const update = await adminCaller.posts.createPost({
      content: 'Voting opens next week.',
      profileId: setup.instance.profileId,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${update.id}:%`));
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const result = await memberCaller.translation.translatePost({
      postId: update.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe('[ES] Voting opens next week.');
  });

  it('rejects a caller without read access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Members-only comment.',
    );

    // An admin of an unrelated decision — no grant on this one.
    const outsider = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.userEmail);

    await expect(
      outsiderCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('hides a flagged comment from a non-admin non-author but not from an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Flagged comment, hidden from non-admins.',
    );

    await db.insert(moderationFlags).values({
      itemType: ModerationItemType.POST,
      itemId: comment.id,
      status: ModerationFlagStatus.FLAGGED,
      source: ModerationSource.AUTOMATED,
      reason: 'translatePost test',
    });

    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, comment.id));
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    expect(mockTranslateText).not.toHaveBeenCalled();

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.translation.translatePost({
      postId: comment.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe(
      '[ES] Flagged comment, hidden from non-admins.',
    );
  });

  it('does not treat a visitor as the author of a flagged post with no author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Flagged comment whose author is unrecorded.',
    );

    // A legacy post: `posts.profileId` is nullable, and a visitor has no
    // profile either — the two nulls must not match as "the author".
    await db
      .update(posts)
      .set({ profileId: null })
      .where(eq(posts.id, comment.id));
    // Detached from its author, the post no longer cascades with test teardown.
    onTestFinished(async () => {
      await db.delete(posts).where(eq(posts.id, comment.id));
    });
    await db.insert(moderationFlags).values({
      itemType: ModerationItemType.POST,
      itemId: comment.id,
      status: ModerationFlagStatus.FLAGGED,
      source: ModerationSource.AUTOMATED,
      reason: 'translatePost test',
    });
    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, comment.id));
    });

    await testData.makeDecisionPublic(setup.instance.profileId);

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('translates an org-feed post for a network member outside the org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { feedPost } = await createFeedPost(
      testData,
      onTestFinished,
      'Our harvest festival is this weekend.',
    );

    const reader = await testData.createDecisionSetup({ instanceCount: 0 });
    const readerCaller = await createAuthenticatedCaller(reader.userEmail);

    const result = await readerCaller.translation.translatePost({
      postId: feedPost.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe('[ES] Our harvest festival is this weekend.');
  });

  it('translates a comment on an org-feed post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, feedPost } = await createFeedPost(
      testData,
      onTestFinished,
      'Feed post with a comment.',
    );

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Count me in for the festival.',
      parentPostId: feedPost.id,
    });
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${comment.id}:%`));
    });

    const reader = await testData.createDecisionSetup({ instanceCount: 0 });
    const readerCaller = await createAuthenticatedCaller(reader.userEmail);

    const result = await readerCaller.translation.translatePost({
      postId: comment.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe('[ES] Count me in for the festival.');
  });

  it('translates a legacy comment on an org-feed post that has no rootPostId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, feedPost } = await createFeedPost(
      testData,
      onTestFinished,
      'Feed post with a legacy reply thread.',
    );

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'A comment from before threads pinned their root.',
      parentPostId: feedPost.id,
    });
    const reply = await memberCaller.posts.createPost({
      content: 'A reply from before threads pinned their root.',
      parentPostId: comment.id,
    });
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${reply.id}:%`));
    });

    // Rows written before `rootPostId` existed were never backfilled.
    await db
      .update(posts)
      .set({ rootPostId: null })
      .where(inArray(posts.id, [comment.id, reply.id]));

    const reader = await testData.createDecisionSetup({ instanceCount: 0 });
    const readerCaller = await createAuthenticatedCaller(reader.userEmail);

    const result = await readerCaller.translation.translatePost({
      postId: reply.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe(
      '[ES] A reply from before threads pinned their root.',
    );
  });

  it('rejects a visitor or non-network caller on an org-feed post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { feedPost } = await createFeedPost(
      testData,
      onTestFinished,
      'Network-only feed post.',
    );

    const nonNetworkCaller = await createNonNetworkCaller(testData);
    await expect(
      nonNetworkCaller.translation.translatePost({
        postId: feedPost.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );
    await expect(
      visitorCaller.translation.translatePost({
        postId: feedPost.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('rejects a post linked to neither a profile nor an organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const [orphan] = await db
      .insert(posts)
      .values({ content: 'Unlinked post.' })
      .returning({ id: posts.id });
    if (!orphan) {
      throw new Error('Failed to insert unlinked post');
    }
    onTestFinished(async () => {
      await db.delete(posts).where(eq(posts.id, orphan.id));
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await expect(
      caller.translation.translatePost({
        postId: orphan.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('limits a flagged org-feed post to its org admins', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { adminCaller, feedPost } = await createFeedPost(
      testData,
      onTestFinished,
      'Flagged feed post.',
    );
    await flagPost(onTestFinished, feedPost.id);

    const reader = await testData.createDecisionSetup({ instanceCount: 0 });
    const readerCaller = await createAuthenticatedCaller(reader.userEmail);
    await expect(
      readerCaller.translation.translatePost({
        postId: feedPost.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();

    const result = await adminCaller.translation.translatePost({
      postId: feedPost.id,
      targetLocale: 'es',
    });
    expect(result.content).toBe('[ES] Flagged feed post.');
  });

  it('limits a flagged org-feed comment to its author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, adminCaller, feedPost } = await createFeedPost(
      testData,
      onTestFinished,
      'Feed post with a flagged comment.',
    );

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Flagged feed comment.',
      parentPostId: feedPost.id,
    });
    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${comment.id}:%`));
    });
    await flagPost(onTestFinished, comment.id);

    await expect(
      adminCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();

    const result = await memberCaller.translation.translatePost({
      postId: comment.id,
      targetLocale: 'es',
    });
    expect(result.content).toBe('[ES] Flagged feed comment.');
  });
});

// openProcedure admits every tier past the gate; the service fails closed (see
// the access tests above).
describeAccessTierGating('translation.translatePost', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),
});

import { db, eq } from '@op/db/client';
import { postReactions, posts, postsToProfiles } from '@op/db/schema';
import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const createAuthenticatedCaller = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
};

const createOutsiderCaller = async (testData: TestDecisionsDataManager) => {
  const outsiderSetup = await testData.createDecisionSetup({
    instanceCount: 0,
  });
  const outsider = await testData.createMemberUser({
    organization: outsiderSetup.organization,
    instanceProfileIds: [],
  });
  return createAuthenticatedCaller(outsider.email);
};

// Confirmed, signed-in user with a non-network email — i.e., NOT in the
// walled garden (no allowedEmailDomains match, no allow-list entry). Used
// to exercise the walled-garden denial path on `posts.createPost` org
// comments. Cleanup is registered via the TestDecisionsDataManager so the
// user / profile row gets torn down with the rest of the test data.
const createNonNetworkCaller = async (testData: TestDecisionsDataManager) => {
  const email = `non-network-${randomUUID()}@example.com`;
  const { user } = await createTestUser(email);
  if (!user) {
    throw new Error(`Failed to create non-network user: ${email}`);
  }
  testData.trackAuthUserForCleanup(user.id);
  const userRecord = await db.query.users.findFirst({
    where: { authUserId: user.id },
  });
  if (userRecord?.profileId) {
    testData.trackProfileForCleanup(userRecord.profileId);
  }
  return createAuthenticatedCaller(email);
};

const fetchPostRoots = async (postId: string) => {
  const [row] = await db
    .select({
      id: posts.id,
      rootProfileId: posts.rootProfileId,
      rootPostId: posts.rootPostId,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) {
    throw new Error(`Post ${postId} not found`);
  }
  return row;
};

describe.concurrent('decision-profile post authorization', () => {
  it('allows a decision admin to create an update on the decision profile', async ({
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
    const post = await caller.posts.createPost({
      content: 'Admin update — first post on the decision.',
      profileId: instance.profileId,
    });

    expect(post.content).toBe('Admin update — first post on the decision.');

    const associations = await db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, post.id));

    expect(associations).toHaveLength(1);
    expect(associations[0]?.profileId).toBe(instance.profileId);
  });

  it('rejects a non-admin member trying to create a top-level update', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });
    const instance = setup.instance;

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const caller = await createAuthenticatedCaller(member.email);

    await expect(
      caller.posts.createPost({
        content: 'Member trying to post — should fail.',
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });

    const writtenPosts = await db
      .select({ id: posts.id })
      .from(posts)
      .innerJoin(postsToProfiles, eq(postsToProfiles.postId, posts.id))
      .where(eq(postsToProfiles.profileId, instance.profileId));

    expect(writtenPosts).toHaveLength(0);
  });

  it('rejects an outsider (different org, no profile role) from posting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });
    const instance = setup.instance;

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider trying to post — should fail.',
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('allows a non-admin member to comment on an admin update', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Comment from a non-admin member.',
      parentPostId: adminPost.id,
    });

    expect(comment.parentPostId).toBe(adminPost.id);
    expect(comment.content).toBe('Comment from a non-admin member.');
  });

  it('rejects an outsider from commenting on an update', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider comment — should fail.',
        parentPostId: adminPost.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('allows a member, and rejects an outsider, reading an update comment thread through getPosts', async ({
    task,
    onTestFinished,
  }) => {
    // The comment thread (DiscussionModal) reads replies via
    // getPosts({ parentPostId }). It resolves to the decision via rootProfileId
    // and stays gated by DECISION: READ — the gate must not reject this path.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const update = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member comment.',
      parentPostId: update.id,
    });

    const thread = await memberCaller.posts.getPosts({
      parentPostId: update.id,
      limit: 50,
      offset: 0,
      includeChildren: false,
    });
    expect(thread.map((p) => p.id)).toContain(comment.id);

    const outsiderCaller = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.posts.getPosts({
        parentPostId: update.id,
        limit: 50,
        offset: 0,
        includeChildren: false,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects reading a decision profile feed through getPosts (routed to listProfilePosts)', async ({
    task,
    onTestFinished,
  }) => {
    // getPosts gates off an explicit DECISION profileId for every caller; the
    // decision feed lives on listProfilePosts. The gate routes by type, not
    // access, so even an authorized member is rejected here.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.posts.getPosts({
        profileId: instance.profileId,
        parentPostId: null,
        limit: 50,
        offset: 0,
        includeChildren: false,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const outsiderCaller = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.posts.getPosts({
        profileId: instance.profileId,
        parentPostId: null,
        limit: 50,
        offset: 0,
        includeChildren: false,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an outsider from fetching an update by postId directly', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update — outsider should not see directly.',
      profileId: instance.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.getPost({
        postId: adminPost.id,
        includeChildren: false,
        maxDepth: 2,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('allows a member to fetch an update by postId directly', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update — member fetches by id.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    const result = await memberCaller.posts.getPost({
      postId: adminPost.id,
      includeChildren: false,
      maxDepth: 2,
    });

    expect(result.id).toBe(adminPost.id);
    expect(result.content).toBe('Admin update — member fetches by id.');
  });

  it('rejects an outsider from reacting to an update', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.toggleLike({
        postId: adminPost.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });

    const reactions = await db
      .select({
        postId: postReactions.postId,
        reactionType: postReactions.reactionType,
      })
      .from(postReactions)
      .where(eq(postReactions.postId, adminPost.id));

    expect(reactions).toHaveLength(0);
  });

  it('allows a member to react to an update', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    await memberCaller.organization.toggleLike({
      postId: adminPost.id,
    });

    const reactions = await db
      .select({
        postId: postReactions.postId,
        reactionType: postReactions.reactionType,
      })
      .from(postReactions)
      .where(eq(postReactions.postId, adminPost.id));

    expect(reactions).toHaveLength(1);
    expect(reactions[0]?.reactionType).toBe('like');
  });

  it('allows a member to react to a comment (gate inherited via rootProfileId)', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member comment.',
      parentPostId: adminPost.id,
    });

    await memberCaller.organization.toggleLike({
      postId: comment.id,
    });

    const reactions = await db
      .select({
        postId: postReactions.postId,
        reactionType: postReactions.reactionType,
      })
      .from(postReactions)
      .where(eq(postReactions.postId, comment.id));

    expect(reactions).toHaveLength(1);
    expect(reactions[0]?.reactionType).toBe('like');
  });

  // Reactions predate the like button and were never migrated, so the toggle
  // has to read a legacy row correctly: a positive type already counts as this
  // caller's like, a thumbs-down does not.
  it('unlikes a post the caller had reacted to with a legacy positive type', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await db.insert(postReactions).values({
      postId: adminPost.id,
      profileId: member.profileId,
      reactionType: 'love',
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    const result = await memberCaller.organization.toggleLike({
      postId: adminPost.id,
    });

    expect(result.action).toBe('removed');
    const reactions = await db
      .select({ postId: postReactions.postId })
      .from(postReactions)
      .where(eq(postReactions.postId, adminPost.id));

    expect(reactions).toHaveLength(0);
  });

  it('replaces a legacy thumbs-down with a like rather than clearing it', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await db.insert(postReactions).values({
      postId: adminPost.id,
      profileId: member.profileId,
      reactionType: 'dislike',
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    const result = await memberCaller.organization.toggleLike({
      postId: adminPost.id,
    });

    expect(result.action).toBe('added');
    const reactions = await db
      .select({ reactionType: postReactions.reactionType })
      .from(postReactions)
      .where(eq(postReactions.postId, adminPost.id));

    expect(reactions).toEqual([{ reactionType: 'like' }]);
  });

  it('toggles a like off on the second call', async ({
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
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    const added = await memberCaller.organization.toggleLike({
      postId: adminPost.id,
    });
    const removed = await memberCaller.organization.toggleLike({
      postId: adminPost.id,
    });

    expect([added.action, removed.action]).toEqual(['added', 'removed']);
    const reactions = await db
      .select({ postId: postReactions.postId })
      .from(postReactions)
      .where(eq(postReactions.postId, adminPost.id));

    expect(reactions).toHaveLength(0);
  });
});

// Org-feed writes are restricted to org admins (resolved via the org-admin
// fallback on `organizationUsers`); regular org members and outsiders fail
// closed at the service-layer write gate, independent of the procedure tier.
// The feed-read and reaction tests below cover sibling endpoints
// (`posts.getPosts`, `organization.toggleLike`) whose org-side authz is
// out of scope for `assertPostWriteAccess` and is intentionally untouched.
describe.concurrent('org-feed post authorization', () => {
  it('admits the org admin (creator) posting on the org profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const post = await caller.posts.createPost({
      content: 'Org admin update on the org profile.',
      profileId: setup.organization.profileId,
    });

    expect(post.content).toBe('Org admin update on the org profile.');
  });

  it('rejects an outsider from posting a top-level update on an org profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider top-level post on org profile — should fail.',
        profileId: setup.organization.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a non-admin org member from posting on the org profile', async ({
    task,
    onTestFinished,
  }) => {
    // The Member role grants `profile: READ` only — not `profile: ADMIN` —
    // so it must not satisfy the write gate even though the user is in the
    // org. Pins that only admin standing (not membership) admits writes.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.posts.createPost({
        content: 'Member post on org profile — should fail.',
        profileId: setup.organization.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a non-walled-garden caller from commenting on an org-feed post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await ownerCaller.posts.createPost({
      content: 'Org-level post.',
      profileId: setup.organization.profileId,
    });

    const nonNetworkCaller = await createNonNetworkCaller(testData);

    await expect(
      nonNetworkCaller.posts.createPost({
        content: 'Non-network comment on org post — should fail.',
        parentPostId: orgPost.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('admits a walled-garden caller commenting on an org-feed post', async ({
    task,
    onTestFinished,
  }) => {
    // Org-post comments gate on walled-garden membership (a network email
    // domain or an allow-list entry), not on per-org membership: anyone
    // inside the walled garden can comment on any org post. The
    // `createMemberUser` helper produces a caller with a network email,
    // which passes the gate without needing an allow-list row.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await ownerCaller.posts.createPost({
      content: 'Org-level post.',
      profileId: setup.organization.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(member.email);
    const comment = await caller.posts.createPost({
      content: 'Walled-garden user comment on org post.',
      parentPostId: orgPost.id,
    });

    expect(comment.parentPostId).toBe(orgPost.id);
    expect(comment.content).toBe('Walled-garden user comment on org post.');
  });

  it('rejects a non-walled-garden caller from commenting on a legacy postsToOrganizations post', async ({
    task,
    onTestFinished,
  }) => {
    // Legacy org-feed posts (via `organization.createPost`) carry no
    // `rootProfileId`, so the write gate resolves the org via the parent
    // post's `postsToOrganizations` link and runs the same walled-garden
    // check used on the modern path.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const legacyPost = await ownerCaller.organization.createPost({
      id: setup.organization.id,
      content: 'Legacy org-feed post.',
    });
    // Legacy posts (profileId/rootProfileId null) escape the data manager's
    // profile-cascade cleanup — delete the row directly.
    onTestFinished(async () => {
      await db.delete(posts).where(eq(posts.id, legacyPost.id));
    });

    const nonNetworkCaller = await createNonNetworkCaller(testData);

    await expect(
      nonNetworkCaller.posts.createPost({
        content: 'Non-network comment on legacy post — should fail.',
        parentPostId: legacyPost.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('treats a comment as a comment even when profileId is also set', async ({
    task,
    onTestFinished,
  }) => {
    // A misuse-but-valid input shape: a caller sends both `profileId` (the
    // org) AND `parentPostId`. resolvePostRoots prefers parentPostId, so the
    // gate must too — otherwise targetProfileId === rootProfileId would
    // route the call through the admin-only announcement gate and reject a
    // legitimate comment.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await ownerCaller.posts.createPost({
      content: 'Org-level post.',
      profileId: setup.organization.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(member.email);
    const comment = await caller.posts.createPost({
      content: 'Comment with both flags set.',
      profileId: setup.organization.profileId,
      parentPostId: orgPost.id,
    });

    expect(comment.parentPostId).toBe(orgPost.id);
  });

  it('does not gate feed reads on non-decision profiles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    await ownerCaller.posts.createPost({
      content: 'Org post visible to outsider.',
      profileId: setup.organization.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);
    const result = await outsiderCaller.posts.getPosts({
      profileId: setup.organization.profileId,
      parentPostId: null,
      limit: 50,
      offset: 0,
      includeChildren: false,
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.map((p) => p.content)).toContain(
      'Org post visible to outsider.',
    );
  });

  it('does not gate likes on non-decision posts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await ownerCaller.posts.createPost({
      content: 'Org post.',
      profileId: setup.organization.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);
    await outsiderCaller.organization.toggleLike({
      postId: orgPost.id,
    });

    const reactions = await db
      .select({
        postId: postReactions.postId,
        reactionType: postReactions.reactionType,
      })
      .from(postReactions)
      .where(eq(postReactions.postId, orgPost.id));

    expect(reactions).toHaveLength(1);
    expect(reactions[0]?.reactionType).toBe('like');
  });
});

// Individual-profile posting isn't a supported surface yet. The write gate
// fail-closes on the profile's server-resolved type so the corresponding
// `posts.createPost` call rejects even for the profile's own owner.
describe.concurrent('individual-profile post authorization', () => {
  it('rejects posting on an individual profile (not supported yet)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.posts.createPost({
        content: 'Self-post on individual profile — should fail.',
        profileId: member.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describe.concurrent('listProfilePosts authorization and pagination', () => {
  it('allows a member to read paginated updates on a decision profile', async ({
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
      content: 'Update one.',
      profileId: instance.profileId,
    });
    await adminCaller.posts.createPost({
      content: 'Update two.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const page = await memberCaller.posts.listProfilePosts({
      profileId: instance.profileId,
      limit: 10,
    });

    expect(page.items).toHaveLength(2);
    expect(page.next ?? null).toBeNull();
  });

  it('rejects an outsider from listing decision-profile updates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.listProfilePosts({
        profileId: instance.profileId,
        limit: 10,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects listProfilePosts on non-decision (org) profiles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    await ownerCaller.posts.createPost({
      content: 'Org-level update.',
      profileId: setup.organization.profileId,
    });

    await expect(
      ownerCaller.posts.listProfilePosts({
        profileId: setup.organization.profileId,
        limit: 10,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('paginates with cursor across multiple pages', async ({
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
    // Sequential creates with a small delay so postsToProfiles.createdAt
    // strictly orders pages even if statements would otherwise share a
    // millisecond. The cursor uses (createdAt, postId) as a tiebreaker, but
    // the spacing keeps the assertions deterministic.
    for (let i = 0; i < 3; i++) {
      await adminCaller.posts.createPost({
        content: `Update ${i}.`,
        profileId: instance.profileId,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const firstPage = await adminCaller.posts.listProfilePosts({
      profileId: instance.profileId,
      limit: 2,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.next).toBeTruthy();

    const secondPage = await adminCaller.posts.listProfilePosts({
      profileId: instance.profileId,
      limit: 2,
      cursor: firstPage.next,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.next ?? null).toBeNull();

    const firstIds = new Set(firstPage.items.map((p) => p.id));
    secondPage.items.forEach((p) => {
      expect(firstIds.has(p.id)).toBe(false);
    });
  });

  it('paginates correctly when comments inherit profile associations from updates', async ({
    task,
    onTestFinished,
  }) => {
    // Comments inherit postsToProfiles rows from their parent (createPost.ts).
    // A naive relational query that filters parentPostId at the post relation
    // returns nulls for comment associations and silently shrinks pages,
    // causing `next` to report null while older updates still exist. Pin
    // SQL-level filtering by interleaving comments with updates and walking
    // every page until exhausted.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const updateIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const update = await adminCaller.posts.createPost({
        content: `Update ${i}.`,
        profileId: instance.profileId,
      });
      updateIds.push(update.id);
      // Two comments per update, each writing inherited postsToProfiles rows
      // ahead of the next update in createdAt order — this is the shape that
      // breaks naive pagination.
      await memberCaller.posts.createPost({
        content: `Comment ${i}.a`,
        parentPostId: update.id,
      });
      await memberCaller.posts.createPost({
        content: `Comment ${i}.b`,
        parentPostId: update.id,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const collected: string[] = [];
    let cursor: string | null | undefined = undefined;
    let pages = 0;
    do {
      const page = await memberCaller.posts.listProfilePosts({
        profileId: instance.profileId,
        limit: 2,
        cursor,
      });
      page.items.forEach((post) => {
        expect(post.parentPostId).toBeNull();
        collected.push(post.id);
      });
      cursor = page.next;
      pages += 1;
      // Defensive bound — should never need more than 3 pages here.
      if (pages > 5) {
        throw new Error('Pagination did not terminate');
      }
    } while (cursor);

    expect(collected).toHaveLength(3);
    expect(new Set(collected)).toEqual(new Set(updateIds));
  });
});

// Proposal profiles carry no permissions of their own — resolvePostRoots
// walks up to the parent decision profile to pin the auth gate. These tests
// pin that contract so the rootProfileId-based dispatch can't regress to a
// lenient pass-through that lets outsiders write on a proposal profile just
// because the proposal profile itself has no policy.
describe.concurrent('proposal post authorization', () => {
  it('rejects an outsider from creating a top-level update on a proposal profile', async ({
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
      proposalData: { title: 'Proposal A', description: 'desc' },
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider top-level on proposal — should fail.',
        profileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects an outsider from commenting on a proposal post', async ({
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
      proposalData: { title: 'Proposal B', description: 'desc' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const proposalPost = await adminCaller.posts.createPost({
      content: 'Admin update on proposal.',
      profileId: proposal.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider comment on proposal post — should fail.',
        parentPostId: proposalPost.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('allows a decision member to comment on a proposal post (gate flows through parent decision)', async ({
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
      proposalData: { title: 'Proposal C', description: 'desc' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const proposalPost = await adminCaller.posts.createPost({
      content: 'Admin update on proposal.',
      profileId: proposal.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member comment on proposal post.',
      parentPostId: proposalPost.id,
    });

    expect(comment.parentPostId).toBe(proposalPost.id);
    expect(comment.content).toBe('Member comment on proposal post.');
  });

  it('allows a member, and rejects an outsider, reading a proposal comment thread through getPosts', async ({
    task,
    onTestFinished,
  }) => {
    // A proposal post pins rootProfileId to the parent decision, so reading its
    // comment thread via getPosts({ parentPostId }) resolves to the decision and
    // is gated by DECISION: READ — the PROPOSAL clause must not over-reject it.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal D', description: 'desc' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const proposalPost = await adminCaller.posts.createPost({
      content: 'Admin update on proposal.',
      profileId: proposal.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member comment on proposal post.',
      parentPostId: proposalPost.id,
    });

    const thread = await memberCaller.posts.getPosts({
      parentPostId: proposalPost.id,
      limit: 50,
      offset: 0,
      includeChildren: false,
    });
    expect(thread.map((p) => p.id)).toContain(comment.id);

    const outsiderCaller = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.posts.getPosts({
        parentPostId: proposalPost.id,
        limit: 50,
        offset: 0,
        includeChildren: false,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  // ProposalComments.tsx posts a "comment on a proposal" as a top-level
  // post with profileId = proposal.profileId and no parentPostId. The
  // service-layer dispatch must not fall through to the decision-ADMIN
  // policy here — proposal targets always walk up to the parent decision
  // via resolvePostRoots, so the gate for a non-admin participant with
  // SUBMIT_PROPOSALS must pass on this exact call shape.
  it('allows a decision member to post a top-level comment on a proposal profile (proposal-comments UI path)', async ({
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
      proposalData: { title: 'Proposal E', description: 'desc' },
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member top-level comment on proposal profile.',
      profileId: proposal.profileId,
    });

    expect(comment.parentPostId).toBeNull();
    expect(comment.content).toBe(
      'Member top-level comment on proposal profile.',
    );
  });

  it('still rejects an outsider from posting a top-level comment on a proposal profile', async ({
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
      proposalData: { title: 'Proposal F', description: 'desc' },
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider top-level comment on proposal — should fail.',
        profileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });
});

// Pin the schema contract introduced by resolvePostRoots: every new post must
// have rootProfileId / rootPostId set per the integration's rules. Behavioral
// tests above only verify auth pass/fail, which would still pass if the
// columns silently went to null. These tests SELECT the actual columns so a
// regression in resolvePostRoots can't slip past.
describe.concurrent('rootProfileId / rootPostId column writes', () => {
  it('writes rootProfileId=instance and rootPostId=null on a top-level decision post', async ({
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
    const post = await caller.posts.createPost({
      content: 'Top-level update.',
      profileId: instance.profileId,
    });

    const row = await fetchPostRoots(post.id);
    expect(row.rootProfileId).toBe(instance.profileId);
    expect(row.rootPostId).toBeNull();
  });

  it('pins rootProfileId to the parent decision on proposal posts and their comments', async ({
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
      proposalData: { title: 'Proposal D', description: 'desc' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const proposalPost = await adminCaller.posts.createPost({
      content: 'Admin update on proposal.',
      profileId: proposal.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member comment on proposal post.',
      parentPostId: proposalPost.id,
    });

    const topRow = await fetchPostRoots(proposalPost.id);
    expect(topRow.rootProfileId).toBe(instance.profileId);
    expect(topRow.rootProfileId).not.toBe(proposal.profileId);
    expect(topRow.rootPostId).toBeNull();

    const commentRow = await fetchPostRoots(comment.id);
    expect(commentRow.rootProfileId).toBe(instance.profileId);
    expect(commentRow.rootPostId).toBe(proposalPost.id);
  });

  it('propagates rootPostId through a 3-deep reply chain', async ({
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
    const topLevel = await adminCaller.posts.createPost({
      content: 'Top-level.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const replyA = await memberCaller.posts.createPost({
      content: 'Reply A.',
      parentPostId: topLevel.id,
    });
    const replyA1 = await memberCaller.posts.createPost({
      content: 'Reply A.1.',
      parentPostId: replyA.id,
    });

    const topRow = await fetchPostRoots(topLevel.id);
    expect(topRow.rootPostId).toBeNull();

    const aRow = await fetchPostRoots(replyA.id);
    expect(aRow.rootPostId).toBe(topLevel.id);
    expect(aRow.rootProfileId).toBe(instance.profileId);

    const a1Row = await fetchPostRoots(replyA1.id);
    expect(a1Row.rootPostId).toBe(topLevel.id);
    expect(a1Row.rootProfileId).toBe(instance.profileId);
  });
});

describe.concurrent('getPosts pagination', () => {
  it('paginates correctly when comments inherit profile associations from updates', async ({
    task,
    onTestFinished,
  }) => {
    // getPosts profileId branch, on an ORG profile (getPosts now serves only
    // org/individual feeds). Comments inherit postsToProfiles rows from their
    // parent; the SQL-level innerJoin keeps offset pagination honest where a
    // relational `with: { post: ... }` LEFT JOIN would silently shrink pages.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const orgProfileId = setup.organization.profileId;

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    // Org-post comments are gated on walled-garden membership; the test
    // owner is created with a network email by createDecisionSetup, so
    // they pass without any extra setup.

    const updateIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const update = await ownerCaller.posts.createPost({
        content: `Update ${i}.`,
        profileId: orgProfileId,
      });
      updateIds.push(update.id);
      await ownerCaller.posts.createPost({
        content: `Comment ${i}.a`,
        parentPostId: update.id,
      });
      await ownerCaller.posts.createPost({
        content: `Comment ${i}.b`,
        parentPostId: update.id,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const collected: string[] = [];
    const limit = 2;
    let offset = 0;
    let pages = 0;
    while (true) {
      const page = await ownerCaller.posts.getPosts({
        profileId: orgProfileId,
        parentPostId: null,
        limit,
        offset,
        includeChildren: false,
      });
      if (page.length === 0) {
        break;
      }
      page.forEach((post) => {
        expect(post.parentPostId).toBeNull();
        collected.push(post.id);
      });
      offset += limit;
      pages += 1;
      if (pages > 5) {
        throw new Error('Pagination did not terminate');
      }
    }

    expect(collected).toHaveLength(3);
    expect(new Set(collected)).toEqual(new Set(updateIds));
  });
});

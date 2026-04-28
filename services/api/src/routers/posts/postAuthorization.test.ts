import { db, eq } from '@op/db/client';
import { postReactions, posts, postsToProfiles } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const createAuthenticatedCaller = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
};

const requireFirstInstance = <T extends { profileId: string }>(
  instances: T[],
): T => {
  const instance = instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  return instance;
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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

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

  it('rejects an outsider from reading the updates feed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.getPosts({
        profileId: instance.profileId,
        parentPostId: null,
        limit: 50,
        offset: 0,
        includeChildren: false,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('allows a member to read the updates feed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.posts.createPost({
      content: 'Admin update for member to read.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);
    const result = await memberCaller.posts.getPosts({
      profileId: instance.profileId,
      parentPostId: null,
      limit: 50,
      offset: 0,
      includeChildren: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe('Admin update for member to read.');
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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.toggleReaction({
        postId: adminPost.id,
        reactionType: 'like',
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });

    const reactions = await db
      .select({ postId: postReactions.postId })
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
    const instance = requireFirstInstance(setup.instances);

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
    await memberCaller.organization.toggleReaction({
      postId: adminPost.id,
      reactionType: 'like',
    });

    const reactions = await db
      .select({ postId: postReactions.postId })
      .from(postReactions)
      .where(eq(postReactions.postId, adminPost.id));

    expect(reactions).toHaveLength(1);
  });
});

// Non-decision profiles intentionally short-circuit the decision-permission
// gate: assertDecisionProfilesAccess returns without checking when the
// associated profile isn't a processInstance. These tests pin that lenient
// pass-through so the helper can't regress to gating regular org/proposal
// feeds. Production callers (e.g. createPostInOrganization) layer their own
// org-membership check on top — that's covered by their own tests, not here.
describe.concurrent('non-decision (organization) post authorization', () => {
  it('does not gate posts on non-decision profiles for the owner', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const post = await caller.posts.createPost({
      content: 'Profile update on a non-decision (organization) profile.',
      profileId: setup.organization.profileId,
    });

    expect(post.content).toBe(
      'Profile update on a non-decision (organization) profile.',
    );
  });

  it('does not gate top-level posts on non-decision profiles for an outsider (helper short-circuits)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const outsiderCaller = await createOutsiderCaller(testData);

    // No throw: assertDecisionProfilesAccess short-circuits because the
    // target profile isn't a processInstance. Documents the helper-level
    // contract — production callers layer org-membership checks separately.
    const post = await outsiderCaller.posts.createPost({
      content: 'Outsider top-level post on a non-decision profile.',
      profileId: setup.organization.profileId,
    });

    expect(post.content).toBe(
      'Outsider top-level post on a non-decision profile.',
    );
  });

  it('does not gate comments on non-decision posts', async ({
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

    const outsiderCaller = await createOutsiderCaller(testData);
    const comment = await outsiderCaller.posts.createPost({
      content: 'Outsider comment on a non-decision post.',
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

  it('does not gate reactions on non-decision posts', async ({
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
    await outsiderCaller.organization.toggleReaction({
      postId: orgPost.id,
      reactionType: 'like',
    });

    const reactions = await db
      .select({ postId: postReactions.postId })
      .from(postReactions)
      .where(eq(postReactions.postId, orgPost.id));

    expect(reactions).toHaveLength(1);
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
    const instance = requireFirstInstance(setup.instances);

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
    const instance = requireFirstInstance(setup.instances);

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.posts.listProfilePosts({
        profileId: instance.profileId,
        limit: 10,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('does not gate listProfilePosts on non-decision profiles', async ({
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

    const outsiderCaller = await createOutsiderCaller(testData);
    const page = await outsiderCaller.posts.listProfilePosts({
      profileId: setup.organization.profileId,
      limit: 10,
    });

    expect(page.items.length).toBeGreaterThanOrEqual(1);
    expect(page.items.map((p) => p.content)).toContain('Org-level update.');
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
    const instance = requireFirstInstance(setup.instances);

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
});

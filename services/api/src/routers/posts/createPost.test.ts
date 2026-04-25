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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.posts.createPost({
        content: 'Outsider trying to post — should fail.',
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('does not gate posts on non-decision (organization) profiles', async ({
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

    const associations = await db
      .select({ profileId: postsToProfiles.profileId })
      .from(postsToProfiles)
      .where(eq(postsToProfiles.postId, post.id));

    expect(associations).toHaveLength(1);
    expect(associations[0]?.profileId).toBe(setup.organization.profileId);
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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

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

  it('rejects an outsider from reacting to an update', async ({
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

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const adminPost = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.organization.addReaction({
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

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

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
    await memberCaller.organization.addReaction({
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

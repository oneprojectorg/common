import { db, eq } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';
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

describe.concurrent('posts.createPost (decision admin authorization)', () => {
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

  it('rejects a non-admin member trying to create an update on the decision profile', async ({
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
    ).rejects.toMatchObject({ cause: { statusCode: 403 } });

    const writtenPosts = await db
      .select({ id: posts.id })
      .from(posts)
      .innerJoin(postsToProfiles, eq(postsToProfiles.postId, posts.id))
      .where(eq(postsToProfiles.profileId, instance.profileId));

    expect(writtenPosts).toHaveLength(0);
  });

  it('rejects an outsider with no access to the decision', async ({
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
    ).rejects.toMatchObject({ cause: { statusCode: 403 } });
  });

  it('allows posting on a non-decision profile (existing profile-update flow)', async ({
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

  it('allows a non-admin member to comment on an admin update (read-path)', async ({
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
});

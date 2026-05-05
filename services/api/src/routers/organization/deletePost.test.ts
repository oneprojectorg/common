import { createPostInOrganization } from '@op/common';
import { db, eq } from '@op/db/client';
import { posts } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

describe.concurrent('deletePost', () => {
  it('should delete a top-level organization post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const { result: post } = await createPostInOrganization({
      id: setup.organization.id,
      content: 'Top-level post to delete',
      user: setup.user,
    });

    await caller.organization.deletePost({
      id: post.id,
      profileId: setup.organization.profileId,
    });

    const deleted = await db.select().from(posts).where(eq(posts.id, post.id));
    expect(deleted).toHaveLength(0);
  });

  it('should delete a comment on an organization post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const { result: parentPost } = await createPostInOrganization({
      id: setup.organization.id,
      content: 'Parent post',
      user: setup.user,
    });

    const userRecord = await db.query.users.findFirst({
      where: { authUserId: setup.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'This is a comment',
        parentPostId: parentPost.id,
        profileId: userRecord!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    await caller.organization.deletePost({
      id: comment.id,
      profileId: setup.organization.profileId,
    });

    const deleted = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(deleted).toHaveLength(0);
  });

  it('should cascade-delete comments when parent post is deleted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const { result: parentPost } = await createPostInOrganization({
      id: setup.organization.id,
      content: 'Parent post with comment',
      user: setup.user,
    });

    const userRecord = await db.query.users.findFirst({
      where: { authUserId: setup.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'Comment that should be cascade-deleted',
        parentPostId: parentPost.id,
        profileId: userRecord!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    await caller.organization.deletePost({
      id: parentPost.id,
      profileId: setup.organization.profileId,
    });

    const deletedParent = await db
      .select()
      .from(posts)
      .where(eq(posts.id, parentPost.id));
    const deletedComment = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));

    expect(deletedParent).toHaveLength(0);
    expect(deletedComment).toHaveLength(0);
  });
});

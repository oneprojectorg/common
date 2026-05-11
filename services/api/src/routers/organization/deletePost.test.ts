import { createPostInOrganization } from '@op/common';
import { db, eq } from '@op/db/client';
import { posts, postsToProfiles } from '@op/db/schema';
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

    await caller.organization.deletePost({ id: post.id });

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

    await caller.organization.deletePost({ id: comment.id });

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

    await caller.organization.deletePost({ id: parentPost.id });

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

  it('should require org admin permission to delete an org post (member role is insufficient)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const { result: post } = await createPostInOrganization({
      id: setup.organization.id,
      content: 'Top-level post in org',
      user: setup.user,
    });

    const member = await testData.createMemberUser({
      organization: { id: setup.organization.id },
    });

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.organization.deletePost({ id: post.id }),
    ).rejects.toThrow();

    const stillThere = await db
      .select()
      .from(posts)
      .where(eq(posts.id, post.id));
    expect(stillThere).toHaveLength(1);
  });

  it('should reject deleting a comment whose parent belongs to a different organization', async ({
    task,
    onTestFinished,
  }) => {
    const testDataA = new TestDecisionsDataManager(
      `${task.id}-orgA`,
      onTestFinished,
    );
    const testDataB = new TestDecisionsDataManager(
      `${task.id}-orgB`,
      onTestFinished,
    );
    const setupA = await testDataA.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });
    const setupB = await testDataB.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const { result: parentPost } = await createPostInOrganization({
      id: setupA.organization.id,
      content: 'Parent post in org A',
      user: setupA.user,
    });

    const userA = await db.query.users.findFirst({
      where: { authUserId: setupA.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'Comment under org A',
        parentPostId: parentPost.id,
        profileId: userA!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    const callerB = await createAuthenticatedCaller(setupB.userEmail);

    await expect(
      callerB.organization.deletePost({ id: comment.id }),
    ).rejects.toThrow();

    const stillThere = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(stillThere).toHaveLength(1);
  });

  it('should allow a comment author to delete their own comment using their individual profile', async ({
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
        content: 'My own comment',
        parentPostId: parentPost.id,
        profileId: userRecord!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    await caller.organization.deletePost({ id: comment.id });

    const deleted = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(deleted).toHaveLength(0);
  });

  it('should reject deleting another users comment via the authors individual-profile path', async ({
    task,
    onTestFinished,
  }) => {
    const ownerData = new TestDecisionsDataManager(
      `${task.id}-owner`,
      onTestFinished,
    );
    const otherData = new TestDecisionsDataManager(
      `${task.id}-other`,
      onTestFinished,
    );
    const ownerSetup = await ownerData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });
    const otherSetup = await otherData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const { result: parentPost } = await createPostInOrganization({
      id: ownerSetup.organization.id,
      content: 'Parent in owner org',
      user: ownerSetup.user,
    });

    const ownerUser = await db.query.users.findFirst({
      where: { authUserId: ownerSetup.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'Owner-authored comment',
        parentPostId: parentPost.id,
        profileId: ownerUser!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    const otherCaller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      otherCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toThrow();

    const stillThere = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(stillThere).toHaveLength(1);
  });

  it('should allow a process admin to delete a proposal-context post they did not author', async ({
    task,
    onTestFinished,
  }) => {
    const adminData = new TestDecisionsDataManager(
      `${task.id}-admin`,
      onTestFinished,
    );
    const authorData = new TestDecisionsDataManager(
      `${task.id}-author`,
      onTestFinished,
    );

    const adminSetup = await adminData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const authorSetup = await authorData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const instance = adminSetup.instances[0];
    if (!instance) {
      throw new Error('No process instance created');
    }

    const proposal = await adminData.createProposal({
      userEmail: adminSetup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal under review' },
    });

    const authorUserRecord = await db.query.users.findFirst({
      where: { authUserId: authorSetup.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'Comment on proposal',
        profileId: authorUserRecord!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    await db.insert(postsToProfiles).values({
      postId: comment.id,
      profileId: proposal.profileId,
    });

    const adminCaller = await createAuthenticatedCaller(adminSetup.userEmail);

    await adminCaller.organization.deletePost({ id: comment.id });

    const deleted = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(deleted).toHaveLength(0);
  });

  it('should reject deleting a proposal-context post when the caller is neither author nor process admin', async ({
    task,
    onTestFinished,
  }) => {
    const adminData = new TestDecisionsDataManager(
      `${task.id}-admin`,
      onTestFinished,
    );
    const strangerData = new TestDecisionsDataManager(
      `${task.id}-stranger`,
      onTestFinished,
    );

    const adminSetup = await adminData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const strangerSetup = await strangerData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const instance = adminSetup.instances[0];
    if (!instance) {
      throw new Error('No process instance created');
    }

    const proposal = await adminData.createProposal({
      userEmail: adminSetup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal under review' },
    });

    const adminUserRecord = await db.query.users.findFirst({
      where: { authUserId: adminSetup.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'Admin-authored proposal comment',
        profileId: adminUserRecord!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    await db.insert(postsToProfiles).values({
      postId: comment.id,
      profileId: proposal.profileId,
    });

    const strangerCaller = await createAuthenticatedCaller(
      strangerSetup.userEmail,
    );

    await expect(
      strangerCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toThrow();

    const stillThere = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(stillThere).toHaveLength(1);
  });

  it('should allow a proposal-context comment author to delete their own comment', async ({
    task,
    onTestFinished,
  }) => {
    const adminData = new TestDecisionsDataManager(
      `${task.id}-admin`,
      onTestFinished,
    );
    const authorData = new TestDecisionsDataManager(
      `${task.id}-author`,
      onTestFinished,
    );

    const adminSetup = await adminData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const authorSetup = await authorData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const instance = adminSetup.instances[0];
    if (!instance) {
      throw new Error('No process instance created');
    }

    const proposal = await adminData.createProposal({
      userEmail: adminSetup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal under review' },
    });

    const authorUserRecord = await db.query.users.findFirst({
      where: { authUserId: authorSetup.user.id },
    });

    const [comment] = await db
      .insert(posts)
      .values({
        content: 'Author-owned proposal comment',
        profileId: authorUserRecord!.profileId!,
      })
      .returning();

    if (!comment) {
      throw new Error('Failed to create comment');
    }

    await db.insert(postsToProfiles).values({
      postId: comment.id,
      profileId: proposal.profileId,
    });

    const authorCaller = await createAuthenticatedCaller(authorSetup.userEmail);

    await authorCaller.organization.deletePost({ id: comment.id });

    const deleted = await db
      .select()
      .from(posts)
      .where(eq(posts.id, comment.id));
    expect(deleted).toHaveLength(0);
  });
});

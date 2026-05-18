import { db, eq } from '@op/db/client';
import { posts } from '@op/db/schema';
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

const requireFirstInstance = <T extends { profileId: string }>(
  instances: T[],
): T => {
  const instance = instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  return instance;
};

const postExists = async (postId: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return Boolean(row);
};

describe.concurrent('organization post deletion (legacy postsToOrganizations)', () => {
  it('allows an org member to delete a post in their organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await ownerCaller.organization.createPost({
      id: setup.organization.id,
      content: 'Org feed post.',
    });

    await ownerCaller.organization.deletePost({ id: orgPost.id });

    expect(await postExists(orgPost.id)).toBe(false);
  });

  it('rejects an outsider from deleting an org post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await ownerCaller.organization.createPost({
      id: setup.organization.id,
      content: 'Org feed post.',
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.deletePost({ id: orgPost.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(orgPost.id)).toBe(true);
  });
});

describe.concurrent('decision update post deletion (postsToProfiles)', () => {
  it('allows the author (decision admin) to delete their own update', async ({
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
    const update = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    await adminCaller.organization.deletePost({ id: update.id });

    expect(await postExists(update.id)).toBe(false);
  });

  it('allows a second decision admin to delete another admin’s update', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const firstAdminCaller = await createAuthenticatedCaller(setup.userEmail);
    const update = await firstAdminCaller.posts.createPost({
      content: 'First admin update.',
      profileId: instance.profileId,
    });

    const secondAdmin = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    await testData.grantProfileAccess(
      instance.profileId,
      secondAdmin.authUserId,
      secondAdmin.email,
      true,
    );

    const secondAdminCaller = await createAuthenticatedCaller(
      secondAdmin.email,
    );
    await secondAdminCaller.organization.deletePost({ id: update.id });

    expect(await postExists(update.id)).toBe(false);
  });

  it('rejects a non-admin member from deleting an admin update', async ({
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
    const update = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.organization.deletePost({ id: update.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(update.id)).toBe(true);
  });

  it('rejects an outsider from deleting an admin update', async ({
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
    const update = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.deletePost({ id: update.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(update.id)).toBe(true);
  });
});

describe.concurrent('decision comment deletion', () => {
  it('allows a member to delete their own comment', async ({
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

    await memberCaller.organization.deletePost({ id: comment.id });

    expect(await postExists(comment.id)).toBe(false);
    expect(await postExists(update.id)).toBe(true);
  });

  it('allows a decision admin to delete a member’s comment', async ({
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

    await adminCaller.organization.deletePost({ id: comment.id });

    expect(await postExists(comment.id)).toBe(false);
  });

  it('rejects a different member from deleting another member’s comment', async ({
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
    const update = await adminCaller.posts.createPost({
      content: 'Admin update.',
      profileId: instance.profileId,
    });

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const authorCaller = await createAuthenticatedCaller(author.email);
    const comment = await authorCaller.posts.createPost({
      content: 'Author comment.',
      parentPostId: update.id,
    });

    const otherMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const otherMemberCaller = await createAuthenticatedCaller(
      otherMember.email,
    );

    await expect(
      otherMemberCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(comment.id)).toBe(true);
  });

  it('rejects an outsider from deleting a comment', async ({
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

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(comment.id)).toBe(true);
  });
});

describe.concurrent('proposal comment deletion', () => {
  it('allows the comment author to delete their own proposal comment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal under discussion' },
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Looks good.',
      profileId: proposal.profileId,
    });

    await memberCaller.organization.deletePost({ id: comment.id });

    expect(await postExists(comment.id)).toBe(false);
  });

  it('rejects an outsider from deleting a proposal comment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal under discussion' },
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Looks good.',
      profileId: proposal.profileId,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(comment.id)).toBe(true);
  });
});

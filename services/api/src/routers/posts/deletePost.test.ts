import { db, eq } from '@op/db/client';
import { posts } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
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
  it('allows an org admin to delete a post in their organization', async ({
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

  it('allows a second org admin (different user) to delete a legacy org post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const firstAdminCaller = await createAuthenticatedCaller(setup.userEmail);
    const orgPost = await firstAdminCaller.organization.createPost({
      id: setup.organization.id,
      content: 'Org feed post by first admin.',
    });

    const secondAdmin = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
      orgRoleId: ROLES.ADMIN.id,
    });
    const secondAdminCaller = await createAuthenticatedCaller(
      secondAdmin.email,
    );
    await secondAdminCaller.account.switchOrganization({
      organizationId: setup.organization.id,
    });

    await secondAdminCaller.organization.deletePost({ id: orgPost.id });

    expect(await postExists(orgPost.id)).toBe(false);
  });

  it('rejects a non-admin org member from deleting an org post', async ({
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

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.organization.deletePost({ id: orgPost.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(orgPost.id)).toBe(true);
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

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const proposalPost = await adminCaller.posts.createPost({
      content: 'Discussion thread root.',
      profileId: proposal.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Looks good.',
      parentPostId: proposalPost.id,
    });

    await memberCaller.organization.deletePost({ id: comment.id });

    expect(await postExists(comment.id)).toBe(false);
    expect(await postExists(proposalPost.id)).toBe(true);
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

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const proposalPost = await adminCaller.posts.createPost({
      content: 'Discussion thread root.',
      profileId: proposal.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Looks good.',
      parentPostId: proposalPost.id,
    });

    const outsiderCaller = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(comment.id)).toBe(true);
  });
});

describe.concurrent('regression: account.switchOrganization spoof', () => {
  // `account.switchOrganization` only requires membership — anyone in the
  // org can land on `currentProfileId = orgProfileId`. The author fast-path
  // must therefore require a `profileUsers` row on `post.profileId`, since
  // org members never get one for org profiles (they hold organizationUsers
  // rows instead). Without that check, any member could delete any post
  // whose `posts.profileId` equals the org's profile id.
  it('rejects a non-admin org member who switched into the org from deleting an admin-authored org-profile post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.account.switchOrganization({
      organizationId: setup.organization.id,
    });
    // posts.createPost stamps posts.profileId from currentProfileId, so the
    // resulting post has profileId = orgProfileId — the exact shape an
    // attacker needs to exploit the fast-path.
    const adminPost = await adminCaller.posts.createPost({
      content: 'Org-profile post via posts.createPost.',
      profileId: setup.organization.profileId,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    await memberCaller.account.switchOrganization({
      organizationId: setup.organization.id,
    });

    await expect(
      memberCaller.organization.deletePost({ id: adminPost.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(adminPost.id)).toBe(true);
  });

  // Counterpart to the spoof test above: an admin (organizationUsers ADMIN)
  // who switched into the org SHOULD be able to delete an org-profile post
  // authored by another admin. posts.createPost stamps posts.profileId from
  // currentProfileId — for a switched-in admin that's the org profile — and
  // the deleter's fast-path correctly skips (no profileUsers row on the org
  // profile), falling through to assertInstanceProfileAccess's org fallback.
  it('lets an org admin delete an admin-authored org-profile post via the org-membership fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const firstAdminCaller = await createAuthenticatedCaller(setup.userEmail);
    await firstAdminCaller.account.switchOrganization({
      organizationId: setup.organization.id,
    });
    const adminPost = await firstAdminCaller.posts.createPost({
      content: 'Org-profile post via posts.createPost.',
      profileId: setup.organization.profileId,
    });

    const secondAdmin = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
      orgRoleId: ROLES.ADMIN.id,
    });
    const secondAdminCaller = await createAuthenticatedCaller(
      secondAdmin.email,
    );
    await secondAdminCaller.account.switchOrganization({
      organizationId: setup.organization.id,
    });

    await secondAdminCaller.organization.deletePost({ id: adminPost.id });

    expect(await postExists(adminPost.id)).toBe(false);
  });
});

describe.concurrent('regression: legacy org post moderation', () => {
  // Legacy `organization.createPost` writes a postsToOrganizations row but
  // no posts.profileId / no postsToProfiles / no rootProfileId. Comments
  // added via the new `posts.createPost` inherit the legacy post's null
  // rootProfileId and (because parent has no postsToProfiles) get no
  // postsToProfiles either. The comment itself has no postsToOrganizations
  // link, so the deletePost query walks up via posts.rootPostId to pick up
  // the legacy root's org link and run the org-membership ADMIN fallback.
  it('lets an org admin delete a comment under a legacy postsToOrganizations post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const legacyPost = await ownerCaller.organization.createPost({
      id: setup.organization.id,
      content: 'Legacy org feed post.',
    });
    // Legacy posts have profileId=NULL with no rootProfileId, so the
    // TestDecisionsDataManager profile-cascade cleanup can't reach them.
    // Tear it down manually to keep the suite-wide leftover-row check happy.
    onTestFinished(async () => {
      await db.delete(posts).where(eq(posts.id, legacyPost.id));
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);
    const comment = await memberCaller.posts.createPost({
      content: 'Member comment under legacy post.',
      parentPostId: legacyPost.id,
    });

    await expect(
      ownerCaller.organization.deletePost({ id: comment.id }),
    ).resolves.toBeUndefined();

    expect(await postExists(comment.id)).toBe(false);
  });

  it('does NOT let a non-admin org member delete a comment under a legacy postsToOrganizations post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    const legacyPost = await ownerCaller.organization.createPost({
      id: setup.organization.id,
      content: 'Legacy org feed post.',
    });
    onTestFinished(async () => {
      await db.delete(posts).where(eq(posts.id, legacyPost.id));
    });

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const authorCaller = await createAuthenticatedCaller(author.email);
    const comment = await authorCaller.posts.createPost({
      content: 'Member comment under legacy post.',
      parentPostId: legacyPost.id,
    });

    const bystander = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const bystanderCaller = await createAuthenticatedCaller(bystander.email);

    await expect(
      bystanderCaller.organization.deletePost({ id: comment.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await postExists(comment.id)).toBe(true);
  });
});

describe.concurrent('regression: orphan author post', () => {
  // Direct-DB-insert simulates a post whose only linkage is posts.profileId
  // (no rootProfileId, no postsToProfiles, no postsToOrganizations). The
  // fast-path must still permit the author (who holds a profileUsers row on
  // their own individual profile via the signup trigger) and reject anyone
  // else.
  it('lets the author delete an orphan post linked only by posts.profileId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    // Use a fresh org member: joinOrganization doesn't touch currentProfileId
    // (only `account.switchOrganization` does), so the member's
    // currentProfileId stays pinned to their individual profile — the same
    // profile that posts.profileId points at and that the signup trigger
    // gave a profileUsers row on. That's exactly the fast-path shape we
    // need to exercise.
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const [orphan] = await db
      .insert(posts)
      .values({
        content: 'Orphan author post.',
        profileId: author.profileId,
      })
      .returning();
    if (!orphan) {
      throw new Error('Failed to insert orphan post');
    }

    const outsiderCaller = await createOutsiderCaller(testData);
    await expect(
      outsiderCaller.organization.deletePost({ id: orphan.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    expect(await postExists(orphan.id)).toBe(true);

    const authorCaller = await createAuthenticatedCaller(author.email);
    await authorCaller.organization.deletePost({ id: orphan.id });
    expect(await postExists(orphan.id)).toBe(false);
  });
});

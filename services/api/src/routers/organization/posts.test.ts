import { db, eq, inArray } from '@op/db/client';
import { posts, postsToOrganizations } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('organization posts', () => {
  const createCaller = createCallerFactory(organizationRouter);

  const callerFor = async (email: string) => {
    const { session } = await createIsolatedSession(email);
    return createCaller(await createTestContextWithSession(session));
  };

  const registerPostCleanup = (
    onTestFinished: (fn: () => void | Promise<void>) => void,
    postIds: string[],
  ) => {
    onTestFinished(async () => {
      if (postIds.length === 0) {
        return;
      }
      await db.delete(posts).where(inArray(posts.id, postIds));
    });
  };

  describe('createPost (createPostInOrganization)', () => {
    it('allows an org admin to create a post on their organization', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
      });

      const caller = await callerFor(adminUser.email);
      const post = await caller.createPost({
        id: organization.id,
        content: 'Admin announcement on the org feed.',
      });
      registerPostCleanup(onTestFinished, [post.id]);

      expect(post.content).toBe('Admin announcement on the org feed.');

      const [join] = await db
        .select()
        .from(postsToOrganizations)
        .where(eq(postsToOrganizations.postId, post.id))
        .limit(1);

      expect(join).toBeDefined();
      expect(join?.organizationId).toBe(organization.id);
    });

    it('allows an org member (non-admin) to create a post on their organization', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, memberUsers } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Expected a member user');
      }

      const caller = await callerFor(memberUser.email);
      const post = await caller.createPost({
        id: organization.id,
        content: 'Member contribution to the org feed.',
      });
      registerPostCleanup(onTestFinished, [post.id]);

      expect(post.content).toBe('Member contribution to the org feed.');
    });

    it('rejects a non-member who tries to post to an organization', async ({
      task,
      onTestFinished,
    }) => {
      const hostData = new TestOrganizationDataManager(
        `${task.id}-host`,
        onTestFinished,
      );
      const outsiderData = new TestOrganizationDataManager(
        `${task.id}-out`,
        onTestFinished,
      );

      const { organization } = await hostData.createOrganization({
        users: { admin: 1 },
      });
      const { adminUser: outsider } = await outsiderData.createOrganization({
        users: { admin: 1 },
      });

      const caller = await callerFor(outsider.email);

      await expect(
        caller.createPost({
          id: organization.id,
          content: 'Outsider should not be able to post here.',
        }),
      ).rejects.toThrow();

      const joins = await db
        .select()
        .from(postsToOrganizations)
        .where(eq(postsToOrganizations.organizationId, organization.id));
      expect(joins).toHaveLength(0);
    });
  });

  describe('listPosts (org main feed)', () => {
    it('returns top-level posts to any authenticated user, including non-members', async ({
      task,
      onTestFinished,
    }) => {
      const hostData = new TestOrganizationDataManager(
        `${task.id}-host`,
        onTestFinished,
      );
      const outsiderData = new TestOrganizationDataManager(
        `${task.id}-out`,
        onTestFinished,
      );

      const { organization, organizationProfile, adminUser } =
        await hostData.createOrganization({ users: { admin: 1 } });
      const { adminUser: outsider } = await outsiderData.createOrganization({
        users: { admin: 1 },
      });

      const adminCaller = await callerFor(adminUser.email);
      const topLevel = await adminCaller.createPost({
        id: organization.id,
        content: 'Top-level org post visible on the home feed.',
      });
      registerPostCleanup(onTestFinished, [topLevel.id]);

      const outsiderCaller = await callerFor(outsider.email);
      const result = await outsiderCaller.listPosts({
        slug: organizationProfile.slug,
      });

      const ids = result.items.map((item) => item.post.id);
      expect(ids).toContain(topLevel.id);
    });
  });
});

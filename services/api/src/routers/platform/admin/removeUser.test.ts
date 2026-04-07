import { db } from '@op/db/client';
import { organizationUsers, profileUsers, users } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { platformAdminRouter } from './index';

const createCaller = createCallerFactory(platformAdminRouter);

describe.concurrent('platform.admin.removeUser', () => {
  describe.concurrent('Authorization', () => {
    it('should reject requests from non-platform-admin users', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: regularUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      const { adminUser: targetUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'target.com',
      });

      const { session } = await createIsolatedSession(regularUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(() =>
        caller.removeUser({ authUserId: targetUser.authUserId }),
      ).rejects.toMatchObject({
        cause: {
          name: 'UnauthorizedError',
        },
      });
    });

    it('should allow platform admins to remove a user', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { adminUser: targetUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'target.com',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.removeUser({
        authUserId: targetUser.authUserId,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe.concurrent('Input Validation', () => {
    it('should reject non-UUID authUserId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(() =>
        caller.removeUser({ authUserId: 'not-a-uuid' }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should return NOT_FOUND for non-existent authUserId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(() =>
        caller.removeUser({
          authUserId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe.concurrent('Cleanup Verification', () => {
    it('should delete the user from the users table', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { adminUser: targetUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'target.com',
      });

      // Verify user exists before removal
      const userBefore = await db._query.users.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
      });
      expect(userBefore).toBeDefined();

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.removeUser({ authUserId: targetUser.authUserId });

      // Verify user is gone
      const userAfter = await db._query.users.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
      });
      expect(userAfter).toBeUndefined();
    });

    it("should delete the user's individual profile", async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { adminUser: targetUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'target.com',
      });

      // Get the user's profile ID before removal
      const userBefore = await db._query.users.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
        columns: { profileId: true },
      });
      expect(userBefore?.profileId).toBeDefined();
      const profileId = userBefore!.profileId!;

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.removeUser({ authUserId: targetUser.authUserId });

      // Verify individual profile is deleted
      const profileAfter = await db._query.profiles.findFirst({
        where: (table, { eq }) => eq(table.id, profileId),
      });
      expect(profileAfter).toBeUndefined();
    });

    it("should cascade-delete the user's organization memberships", async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { adminUser: targetUser, organization } =
        await testData.createOrganization({
          users: { admin: 1 },
          emailDomain: 'target.com',
        });

      // Verify organization membership exists
      const orgUserBefore = await db._query.organizationUsers.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
      });
      expect(orgUserBefore).toBeDefined();

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.removeUser({ authUserId: targetUser.authUserId });

      // Verify organization membership is gone (cascade from auth user deletion)
      const orgUserAfter = await db._query.organizationUsers.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
      });
      expect(orgUserAfter).toBeUndefined();
    });

    it("should cascade-delete the user's profile memberships", async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const { adminUser: targetUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'target.com',
      });

      // Verify profile user exists
      const profileUserBefore = await db._query.profileUsers.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
      });
      expect(profileUserBefore).toBeDefined();

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.removeUser({ authUserId: targetUser.authUserId });

      // Verify profile user is gone (cascade from auth user deletion)
      const profileUserAfter = await db._query.profileUsers.findFirst({
        where: (table, { eq }) =>
          eq(table.authUserId, targetUser.authUserId),
      });
      expect(profileUserAfter).toBeUndefined();
    });

    it('should not affect other users in the same organization', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { adminUser: platformAdmin } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'oneproject.org',
      });

      const {
        adminUser: targetUser,
        memberUsers,
        organization,
      } = await testData.createOrganization({
        users: { admin: 1, member: 1 },
        emailDomain: 'target.com',
      });

      const otherUser = memberUsers[0]!;

      const { session } = await createIsolatedSession(platformAdmin.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.removeUser({ authUserId: targetUser.authUserId });

      // Verify the other user in the same organization is unaffected
      const otherUserRecord = await db._query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, otherUser.authUserId),
      });
      expect(otherUserRecord).toBeDefined();

      const otherOrgUser = await db._query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, otherUser.authUserId),
            eq(table.organizationId, organization.id),
          ),
      });
      expect(otherOrgUser).toBeDefined();
    });
  });
});

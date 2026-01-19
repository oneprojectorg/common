import { db } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { TestProfileUserDataManager } from '../../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { usersRouter } from './index';

// Mock the event system to avoid Inngest API calls in tests
vi.mock('@op/events', async () => {
  const actual = await vi.importActual('@op/events');
  return {
    ...actual,
    event: {
      send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }),
    },
  };
});

describe.concurrent('profile.users', () => {
  const createCaller = createCallerFactory(usersRouter);

  describe('listUsers', () => {
    it('should list all users for a profile', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.listUsers({
        profileId: profile.id,
      });

      expect(result).toHaveLength(3);
      expect(result.map((u) => u.email)).toContain(adminUser.email);
      expect(result.map((u) => u.email)).toContain(memberUsers[0]?.email);
      expect(result.map((u) => u.email)).toContain(memberUsers[1]?.email);
    });

    it('should return users with their roles', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.listUsers({
        profileId: profile.id,
      });

      const admin = result.find((u) => u.email === adminUser.email);
      expect(admin).toBeDefined();
      expect(admin?.roles).toHaveLength(1);
      expect(admin?.roles[0]?.name).toBe(ROLES.ADMIN.name);
    });

    it('should throw error for non-admin users', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Member user not created');
      }

      const { session } = await createIsolatedSession(memberUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.listUsers({
          profileId: profile.id,
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid profile ID', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createProfile();

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.listUsers({
          profileId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow();
    });
  });

  describe('addUser', () => {
    it('should add a user to the profile', async ({ task, onTestFinished }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      // Create a standalone user to be added
      const standaloneUser = await testData.createStandaloneUser();

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.addUser({
        profileId: profile.id,
        email: standaloneUser.email,
        roleIds: [ROLES.MEMBER.id],
      });

      expect(result).toBeDefined();
      expect(result.email).toBe(standaloneUser.email);

      // Verify user was added to the profile
      const addedUser = await db.query.profileUsers.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.profileId, profile.id),
            eq(table.email, standaloneUser.email),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(addedUser).toBeDefined();
      expect(addedUser?.roles).toHaveLength(1);
      expect(addedUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
    });

    it('should fail when user is already a member', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Member user not created');
      }

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.addUser({
          profileId: profile.id,
          email: memberUser.email,
          roleIds: [ROLES.MEMBER.id],
        }),
      ).rejects.toThrow();
    });

    it('should fail when non-admin tries to add user', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Member user not created');
      }

      const standaloneUser = await testData.createStandaloneUser();

      const { session } = await createIsolatedSession(memberUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.addUser({
          profileId: profile.id,
          email: standaloneUser.email,
          roleIds: [ROLES.MEMBER.id],
        }),
      ).rejects.toThrow();
    });

    it('should add new email to allowList with personalMessage', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      // Generate a new email that doesn't exist in the system
      const newEmail = `new-user-${task.id}@oneproject.org`;
      testData.trackAllowListEmail(newEmail);

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const personalMessage = 'Welcome to our team!';
      const result = await caller.addUser({
        profileId: profile.id,
        email: newEmail,
        roleIds: [ROLES.MEMBER.id],
        personalMessage,
      });

      expect(result).toBeDefined();
      expect(result.email).toBe(newEmail.toLowerCase());

      // Verify the allowList entry was created with the personalMessage
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, newEmail.toLowerCase()),
      });

      expect(allowListEntry).toBeDefined();
      expect(allowListEntry?.metadata).toBeDefined();

      const metadata = allowListEntry?.metadata as {
        personalMessage?: string;
        inviteType?: string;
        roleIds?: string[];
        profileId?: string;
      };
      expect(metadata.personalMessage).toBe(personalMessage);
      expect(metadata.inviteType).toBe('profile');
      expect(metadata.roleIds).toEqual([ROLES.MEMBER.id]);
      expect(metadata.profileId).toBe(profile.id);
    });
  });

  describe('updateUserRoles', () => {
    it('should update user roles', async ({ task, onTestFinished }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Member user not created');
      }

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Update member to admin
      const result = await caller.updateUserRoles({
        profileUserId: memberUser.profileUserId,
        roleIds: [ROLES.ADMIN.id],
      });

      expect(result).toBeDefined();

      // Verify role was updated
      const updatedUser = await db.query.profileUsers.findFirst({
        where: eq(profileUsers.id, memberUser.profileUserId),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(updatedUser?.roles).toHaveLength(1);
      expect(updatedUser?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
    });

    it('should fail when non-admin tries to update roles', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 2 },
        profileName: 'Role Update Test',
      });

      const memberUser1 = memberUsers[0];
      const memberUser2 = memberUsers[1];
      if (!memberUser1 || !memberUser2) {
        throw new Error('Member users not created');
      }

      const { session } = await createIsolatedSession(memberUser1.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.updateUserRoles({
          profileUserId: memberUser2.profileUserId,
          roleIds: [ROLES.ADMIN.id],
        }),
      ).rejects.toThrow();
    });
  });

  describe('removeUser', () => {
    it('should remove a user from the profile', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Member user not created');
      }

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.removeUser({
        profileUserId: memberUser.profileUserId,
      });

      // Verify user was removed
      const removedUser = await db.query.profileUsers.findFirst({
        where: eq(profileUsers.id, memberUser.profileUserId),
      });

      expect(removedUser).toBeUndefined();
    });

    it('should fail when non-admin tries to remove user', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 2 },
        profileName: 'Remove User Test',
      });

      const memberUser1 = memberUsers[0];
      const memberUser2 = memberUsers[1];
      if (!memberUser1 || !memberUser2) {
        throw new Error('Member users not created');
      }

      const { session } = await createIsolatedSession(memberUser1.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.removeUser({
          profileUserId: memberUser2.profileUserId,
        }),
      ).rejects.toThrow();
    });
  });
});

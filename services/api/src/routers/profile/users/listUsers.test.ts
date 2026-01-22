import { ROLES } from '@op/db/seedData/accessControl';
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

describe.concurrent('profile.users.listUsers', () => {
  const createCaller = createCallerFactory(usersRouter);

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
      throw new Error('Expected memberUser to be defined');
    }

    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.listUsers({
        profileId: profile.id,
      }),
    ).rejects.toThrow(/not authenticated/i);
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
    ).rejects.toThrow(/not found/i);
  });

  describe('sorting', () => {
    it('should sort users by name with admin first in asc and last in desc', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const resultAsc = await caller.listUsers({
        profileId: profile.id,
        orderBy: 'name',
        dir: 'asc',
      });

      const resultDesc = await caller.listUsers({
        profileId: profile.id,
        orderBy: 'name',
        dir: 'desc',
      });

      expect(resultAsc).toHaveLength(3);
      expect(resultDesc).toHaveLength(3);

      // Test data creates names like "Test Admin User" and "Test Member User"
      // "Test Admin User" < "Test Member User" alphabetically (A < M after "Test ")
      // So admin should be first in ASC order and last in DESC order
      expect(resultAsc[0]?.email).toBe(adminUser.email);
      expect(resultDesc[resultDesc.length - 1]?.email).toBe(adminUser.email);
    });

    it('should reverse order when switching between asc and desc for email', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const resultAsc = await caller.listUsers({
        profileId: profile.id,
        orderBy: 'email',
        dir: 'asc',
      });

      const resultDesc = await caller.listUsers({
        profileId: profile.id,
        orderBy: 'email',
        dir: 'desc',
      });

      expect(resultAsc).toHaveLength(3);
      expect(resultDesc).toHaveLength(3);

      // Emails are unique, so ascending and descending should be exact reverses
      const ascEmails = resultAsc.map((u) => u.email);
      const descEmails = resultDesc.map((u) => u.email);
      expect(ascEmails).toEqual([...descEmails].reverse());
    });

    it('should sort users by role with admin first in asc and last in desc', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const resultAsc = await caller.listUsers({
        profileId: profile.id,
        orderBy: 'role',
        dir: 'asc',
      });

      const resultDesc = await caller.listUsers({
        profileId: profile.id,
        orderBy: 'role',
        dir: 'desc',
      });

      expect(resultAsc).toHaveLength(3);
      expect(resultDesc).toHaveLength(3);

      // "Admin" comes before "Member" alphabetically
      // So admin should be first in ASC order and last in DESC order
      expect(resultAsc[0]?.email).toBe(adminUser.email);
      expect(resultDesc[resultDesc.length - 1]?.email).toBe(adminUser.email);
    });
  });

  describe('search', () => {
    it('should return all users when no query is provided', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.listUsers({
        profileId: profile.id,
      });

      expect(result).toHaveLength(3);
    });

    it('should filter users by name match', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Test data creates names like "Test Admin User" and "Test Member User"
      // Searching for "Admin" should only return the admin user
      const result = await caller.listUsers({
        profileId: profile.id,
        query: 'Admin',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe(adminUser.email);
    });

    it('should filter users by email match', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Test data creates emails like "{testId}-admin-{random}@oneproject.org"
      // Searching for "-member-" should only return member users
      const result = await caller.listUsers({
        profileId: profile.id,
        query: '-member-',
      });

      expect(result).toHaveLength(2);
      expect(result.map((u) => u.email)).toContain(memberUsers[0]?.email);
      expect(result.map((u) => u.email)).toContain(memberUsers[1]?.email);
    });

    it('should be case-insensitive', async ({ task, onTestFinished }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Search with lowercase should still match "Test Admin User"
      const result = await caller.listUsers({
        profileId: profile.id,
        query: 'admin',
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe(adminUser.email);
    });

    it('should return empty array when no matches found', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.listUsers({
        profileId: profile.id,
        query: 'nonexistent-user-xyz',
      });

      expect(result).toHaveLength(0);
    });

    it('should ignore queries shorter than 2 characters', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Single character query should be ignored and return all users
      const result = await caller.listUsers({
        profileId: profile.id,
        query: 'a',
      });

      expect(result).toHaveLength(3);
    });

    it('should work with sorting parameters', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 2 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Search for "member" and sort by email descending
      const result = await caller.listUsers({
        profileId: profile.id,
        query: 'member',
        orderBy: 'email',
        dir: 'desc',
      });

      expect(result).toHaveLength(2);
      // Verify results are sorted descending by email
      const emails = result.map((u) => u.email);
      expect(emails).toEqual([...emails].sort().reverse());
    });
  });
});

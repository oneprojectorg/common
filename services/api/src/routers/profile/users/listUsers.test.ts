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

    expect(result.items).toHaveLength(3);
    expect(result.items.map((u) => u.email)).toContain(adminUser.email);
    expect(result.items.map((u) => u.email)).toContain(memberUsers[0]?.email);
    expect(result.items.map((u) => u.email)).toContain(memberUsers[1]?.email);
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

    const admin = result.items.find((u) => u.email === adminUser.email);
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

      expect(resultAsc.items).toHaveLength(3);
      expect(resultDesc.items).toHaveLength(3);

      // Test data creates names like "Test Admin User" and "Test Member User"
      // "Test Admin User" < "Test Member User" alphabetically (A < M after "Test ")
      // So admin should be first in ASC order and last in DESC order
      expect(resultAsc.items[0]?.email).toBe(adminUser.email);
      expect(resultDesc.items[resultDesc.items.length - 1]?.email).toBe(
        adminUser.email,
      );
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

      expect(resultAsc.items).toHaveLength(3);
      expect(resultDesc.items).toHaveLength(3);

      // Emails are unique, so ascending and descending should be exact reverses
      const ascEmails = resultAsc.items.map((u) => u.email);
      const descEmails = resultDesc.items.map((u) => u.email);
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

      expect(resultAsc.items).toHaveLength(3);
      expect(resultDesc.items).toHaveLength(3);

      // "Admin" comes before "Member" alphabetically
      // So admin should be first in ASC order and last in DESC order
      expect(resultAsc.items[0]?.email).toBe(adminUser.email);
      expect(resultDesc.items[resultDesc.items.length - 1]?.email).toBe(
        adminUser.email,
      );
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

      expect(result.items).toHaveLength(3);
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

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.email).toBe(adminUser.email);
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

      expect(result.items).toHaveLength(2);
      expect(result.items.map((u) => u.email)).toContain(memberUsers[0]?.email);
      expect(result.items.map((u) => u.email)).toContain(memberUsers[1]?.email);
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

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.email).toBe(adminUser.email);
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

      expect(result.items).toHaveLength(0);
    });

    it('should reject queries shorter than 2 characters', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Single character query should be rejected with validation error
      await expect(
        caller.listUsers({
          profileId: profile.id,
          query: 'a',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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

      expect(result.items).toHaveLength(2);
      // Verify results are sorted descending by email
      const emails = result.items.map((u) => u.email);
      expect(emails).toEqual([...emails].sort().reverse());
    });
  });

  describe('pagination', () => {
    it('should return paginated response with items, next cursor, and hasMore', async ({
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
        limit: 2,
      });

      expect(result.items).toHaveLength(2);
      expect(result.next).toBeTruthy();
    });

    it('should return hasMore=false when all results fit in limit', async ({
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
        limit: 10,
      });

      expect(result.items).toHaveLength(3);
      expect(result.next).toBeNull();
    });

    it('should paginate through all results using cursor with no duplicates', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 4 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Collect all emails across pages
      const allEmails: string[] = [];
      let cursor: string | null | undefined;
      let pageCount = 0;

      do {
        const page = await caller.listUsers({
          profileId: profile.id,
          limit: 2,
          cursor: cursor ?? undefined,
          orderBy: 'email',
          dir: 'asc',
        });

        allEmails.push(...page.items.map((u) => u.email));
        cursor = page.next;
        pageCount++;

        // Safety check to prevent infinite loops
        if (pageCount > 10) {
          throw new Error('Too many pages - possible infinite loop');
        }
      } while (cursor);

      // Verify we got all 5 items
      expect(allEmails).toHaveLength(5);

      // Verify no duplicates
      const uniqueEmails = new Set(allEmails);
      expect(uniqueEmails.size).toBe(5);

      // Verify all expected users are present
      expect(allEmails).toContain(adminUser.email);
      memberUsers.forEach((m) => {
        expect(allEmails).toContain(m.email);
      });

      // Verify correct ascending order across all pages
      const sortedEmails = [...allEmails].sort();
      expect(allEmails).toEqual(sortedEmails);

      // Verify we needed 3 pages (2 + 2 + 1)
      expect(pageCount).toBe(3);
    });

    it('should work with search and pagination combined', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 4 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Search for "member" with pagination
      const allEmails: string[] = [];
      let cursor: string | null | undefined;

      do {
        const page = await caller.listUsers({
          profileId: profile.id,
          query: 'member',
          limit: 2,
          cursor: cursor ?? undefined,
          orderBy: 'email',
          dir: 'asc',
        });

        allEmails.push(...page.items.map((u) => u.email));
        cursor = page.next;
      } while (cursor);

      // All 4 members returned, admin filtered out
      expect(allEmails).toHaveLength(4);
      expect(new Set(allEmails).size).toBe(4); // No duplicates
      expect(allEmails).not.toContain(adminUser.email);
      memberUsers.forEach((m) => {
        expect(allEmails).toContain(m.email);
      });
    });

    it('should return all results when no limit specified', async ({
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

      // With only 3 users (less than default limit), all should be returned
      expect(result.items).toHaveLength(3);
      expect(result.next).toBeNull();
    });

    it('should throw error for invalid cursor', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(
        caller.listUsers({
          profileId: profile.id,
          limit: 10,
          cursor: 'invalid-cursor',
        }),
      ).rejects.toThrow();
    });

    it('should paginate correctly when ordering by name', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 4 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Collect all names across pages, ordered by name ascending
      const allNames: (string | null)[] = [];
      let cursor: string | null | undefined;
      let pageCount = 0;

      do {
        const page = await caller.listUsers({
          profileId: profile.id,
          limit: 2,
          cursor: cursor ?? undefined,
          orderBy: 'name',
          dir: 'asc',
        });

        allNames.push(...page.items.map((u) => u.name));
        cursor = page.next;
        pageCount++;

        if (pageCount > 10) {
          throw new Error('Too many pages - possible infinite loop');
        }
      } while (cursor);

      // Verify we got all 5 items
      expect(allNames).toHaveLength(5);

      // Verify no duplicates (by checking unique count matches total)
      const uniqueNames = new Set(allNames);
      expect(uniqueNames.size).toBe(5);

      // Verify correct alphabetical order
      const sortedNames = [...allNames].sort((a, b) =>
        (a ?? '').localeCompare(b ?? ''),
      );
      expect(allNames).toEqual(sortedNames);
    });

    it('should paginate correctly when ordering by role', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 4 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Collect all users across pages, ordered by role ascending
      const allEmails: string[] = [];
      let cursor: string | null | undefined;
      let pageCount = 0;

      do {
        const page = await caller.listUsers({
          profileId: profile.id,
          limit: 2,
          cursor: cursor ?? undefined,
          orderBy: 'role',
          dir: 'asc',
        });

        allEmails.push(...page.items.map((u) => u.email));
        cursor = page.next;
        pageCount++;

        if (pageCount > 10) {
          throw new Error('Too many pages - possible infinite loop');
        }
      } while (cursor);

      // Verify we got all 5 items with no duplicates
      expect(allEmails).toHaveLength(5);
      expect(new Set(allEmails).size).toBe(5);

      // Admin should be first (A < M alphabetically)
      expect(allEmails[0]).toBe(adminUser.email);
    });
  });

  describe('pending invites', () => {
    it('should include pending invites in member list with status pending', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      // Create an invite for a new user
      const newEmail = `pending-invite-${task.id}@oneproject.org`;
      testData.trackAllowListEmail(newEmail);
      testData.trackProfileInvite(newEmail, profile.id);

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      // Create the invite using addUser
      await caller.addUser({
        profileId: profile.id,
        inviteeEmail: newEmail,
        roleIdsToAssign: [ROLES.MEMBER.id],
      });

      // List users - should include pending invite
      const result = await caller.listUsers({
        profileId: profile.id,
      });

      // Should have 2 active members + 1 pending invite = 3 total
      expect(result.items).toHaveLength(3);

      // Find the pending invite
      const pendingMember = result.items.find(
        (item) => item.email === newEmail.toLowerCase(),
      );

      expect(pendingMember).toBeDefined();
      expect(pendingMember?.status).toBe('pending');
      expect(pendingMember?.inviteId).toBeDefined();
    });

    it('should have status active for existing members', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser, memberUsers } = await testData.createProfile({
        users: { admin: 1, member: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.listUsers({
        profileId: profile.id,
      });

      // All existing members should have status 'active'
      const adminMember = result.items.find(
        (item) => item.email === adminUser.email,
      );
      const regularMember = result.items.find(
        (item) => item.email === memberUsers[0]?.email,
      );

      expect(adminMember?.status).toBe('active');
      expect(regularMember?.status).toBe('active');

      // Active members should not have inviteId
      expect(adminMember?.inviteId).toBeUndefined();
      expect(regularMember?.inviteId).toBeUndefined();
    });

    it('should include pending invite roles', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      // Create an invite for a new user with Member role
      const newEmail = `pending-role-${task.id}@oneproject.org`;
      testData.trackAllowListEmail(newEmail);
      testData.trackProfileInvite(newEmail, profile.id);

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.addUser({
        profileId: profile.id,
        inviteeEmail: newEmail,
        roleIdsToAssign: [ROLES.MEMBER.id],
      });

      const result = await caller.listUsers({
        profileId: profile.id,
      });

      const pendingMember = result.items.find(
        (item) => item.email === newEmail.toLowerCase(),
      );

      expect(pendingMember?.roles).toHaveLength(1);
      expect(pendingMember?.roles[0]?.id).toBe(ROLES.MEMBER.id);
    });

    it('should filter pending invites by search query', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1 },
      });

      // Create two invites with different emails
      const email1 = `searchable-alpha-${task.id}@oneproject.org`;
      const email2 = `searchable-beta-${task.id}@oneproject.org`;
      testData.trackAllowListEmail(email1);
      testData.trackAllowListEmail(email2);
      testData.trackProfileInvite(email1, profile.id);
      testData.trackProfileInvite(email2, profile.id);

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.addUser({
        profileId: profile.id,
        inviteeEmail: email1,
        roleIdsToAssign: [ROLES.MEMBER.id],
      });

      await caller.addUser({
        profileId: profile.id,
        inviteeEmail: email2,
        roleIdsToAssign: [ROLES.MEMBER.id],
      });

      // Search for 'alpha' should only return the first invite
      const result = await caller.listUsers({
        profileId: profile.id,
        query: 'alpha',
      });

      // Should only find the alpha invite (admin doesn't match 'alpha')
      const pendingItems = result.items.filter(
        (item) => item.status === 'pending',
      );
      expect(pendingItems).toHaveLength(1);
      expect(pendingItems[0]?.email).toBe(email1.toLowerCase());
    });

    it('should show pending invites only on last page of active members', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestProfileUserDataManager(task.id, onTestFinished);
      const { profile, adminUser } = await testData.createProfile({
        users: { admin: 1, member: 3 },
      });

      // Create a pending invite
      const newEmail = `pending-pagination-${task.id}@oneproject.org`;
      testData.trackAllowListEmail(newEmail);
      testData.trackProfileInvite(newEmail, profile.id);

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await caller.addUser({
        profileId: profile.id,
        inviteeEmail: newEmail,
        roleIdsToAssign: [ROLES.MEMBER.id],
      });

      // First page with limit 2 - should NOT include pending invites
      const page1 = await caller.listUsers({
        profileId: profile.id,
        limit: 2,
        orderBy: 'email',
        dir: 'asc',
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.next).toBeTruthy();

      // All items on first page should be active
      page1.items.forEach((item) => {
        expect(item.status).toBe('active');
      });

      // Get remaining pages until we have all items
      let allItems = [...page1.items];
      let cursor = page1.next;

      while (cursor) {
        const nextPage = await caller.listUsers({
          profileId: profile.id,
          limit: 2,
          cursor,
          orderBy: 'email',
          dir: 'asc',
        });
        allItems = [...allItems, ...nextPage.items];
        cursor = nextPage.next;
      }

      // Total should be 4 active + 1 pending = 5
      expect(allItems).toHaveLength(5);

      // Pending invite should be in the results
      const pendingItem = allItems.find((item) => item.status === 'pending');
      expect(pendingItem).toBeDefined();
      expect(pendingItem?.email).toBe(newEmail.toLowerCase());
    });
  });
});

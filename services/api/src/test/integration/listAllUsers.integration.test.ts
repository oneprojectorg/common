import { TContext } from 'src/types';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '../../routers/platform/admin';
import { createCallerFactory } from '../../trpcFactory';
import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';
import {
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('platform.admin.listAllUsers', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  const createTestContext = (jwt: string): TContext => ({
    jwt,
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    requestId: 'test-request-id',
    getCookies: () => ({}),
    getCookie: () => undefined,
    setCookie: () => {},
    time: Date.now(),
    isServerSideCall: true,
  });

  it('should successfully list all users as platform admin', async ({
    task,
  }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 2 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));
    const result = await caller.listAllUsers({ limit: 10 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.hasMore).toBe(false);
  });

  it('should throw error when non-platform admin tries to list all users', async ({
    task,
  }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
      emailDomain: 'example.com',
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    await expect(() => caller.listAllUsers()).rejects.toThrow();
  });

  it('should support pagination with cursor', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 3 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    const firstPage = await caller.listAllUsers({ limit: 2 });
    expect(firstPage.items.length).toBeLessThanOrEqual(2);

    if (firstPage.next) {
      const secondPage = await caller.listAllUsers({
        limit: 2,
        cursor: firstPage.next,
      });

      const firstPageIds = firstPage.items.map((user) => user.id);
      const secondPageIds = secondPage.items.map((user) => user.id);
      const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
      expect(overlap.length).toBe(0);
    }
  });

  it('should return correct hasMore flag', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 5 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));
    const result = await caller.listAllUsers({ limit: 1000 });

    expect(result.hasMore).toBe(false);
    expect(result.next).toBeNull();
  });

  it('should handle invalid cursor gracefully', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    await expect(() =>
      caller.listAllUsers({ limit: 10, cursor: 'invalid-cursor' }),
    ).rejects.toThrow();
  });

  it('should respect limit parameter', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 5 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));
    const result = await caller.listAllUsers({ limit: 3 });

    expect(result.items.length).toBeLessThanOrEqual(3);
  });

  it('should sort users by updatedAt ascending', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 3 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));
    const result = await caller.listAllUsers({ limit: 10, dir: 'asc' });

    for (let i = 0; i < result.items.length - 1; i++) {
      const current = result.items[i];
      const next = result.items[i + 1];
      if (current?.updatedAt && next?.updatedAt) {
        expect(new Date(current.updatedAt).getTime()).toBeLessThanOrEqual(
          new Date(next.updatedAt).getTime(),
        );
      }
    }
  });

  it('should filter users by search query matching specific email', async ({
    task,
  }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 2 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    const firstWord = task.id;
    const result = await caller.listAllUsers({
      limit: 100,
      query: firstWord,
    });
    // Should find at least the admin user
    expect(result.items.length).toBeGreaterThan(0);

    // Verify the admin user is in the results
    const adminFound = result.items.some(
      (user) => user.email === adminUser.email,
    );
    expect(adminFound).toBe(true);
  });

  it('should return empty results for non-matching search query', async ({
    task,
  }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    // Search with a very specific string that shouldn't match any users
    const result = await caller.listAllUsers({
      limit: 10,
      query: 'xyznonexistent9999',
    });

    expect(result.items.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('should support prefix matching in email search', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser, adminUsers, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 2 },
      });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    const result = await caller.listAllUsers({
      limit: 100,
      query: task.id,
    });

    const foundEmails = result.items.map((user) => user.email);
    const createdEmails = [...adminUsers, ...memberUsers].map((u) => u.email);

    // Verify all found emails belong to the created users
    foundEmails.forEach((email) => {
      expect(createdEmails).toContain(email);
    });
  });

  it('should handle search with domain name', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    // Search by domain name (oneproject)
    const result = await caller.listAllUsers({
      limit: 100,
      query: task.id,
    });

    // Should find users with @oneproject.org emails
    expect(result.items.length).toBeGreaterThan(0);
    const allHaveCorrectDomain = result.items.every((user) =>
      user.email.includes('oneproject'),
    );
    expect(allHaveCorrectDomain).toBe(true);

    // Search by domain name (oneproject)
    const result2 = await caller.listAllUsers({
      limit: 100,
      query: 'oneproject',
    });

    // Should find users with @oneproject.org emails
    expect(result2.items.length).toBeGreaterThan(0);
  });

  it('should work with search and pagination together', async ({ task }) => {
    const testData = new TestOrganizationDataManager(task.id);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 5 },
    });

    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    const caller = createCaller(createTestContext(session.access_token));

    // Search with the task id prefix
    // const searchTerm = task.id.split(/[^a-zA-Z0-9]+/)[0];
    const searchTerm = task.id;
    if (!searchTerm) {
      throw new Error('Unable to extract search term from task.id');
    }

    const firstPage = await caller.listAllUsers({
      limit: 2,
      query: searchTerm,
    });

    expect(firstPage.items.length).toBeGreaterThan(0);

    // If there are more results, test pagination
    if (firstPage.next && firstPage.hasMore) {
      const secondPage = await caller.listAllUsers({
        limit: 2,
        cursor: firstPage.next,
        query: searchTerm,
      });

      // Verify no overlap between pages
      const firstPageIds = firstPage.items.map((user) => user.id);
      const secondPageIds = secondPage.items.map((user) => user.id);
      const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
      expect(overlap.length).toBe(0);

      // All results should still match the search query
      secondPage.items.forEach((user) => {
        expect(user.email.toLowerCase()).toContain(searchTerm.toLowerCase());
      });
    }
  });
});

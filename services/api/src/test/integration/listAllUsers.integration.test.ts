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

  it('should sort users by updatedAt descending', async ({ task }) => {
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
    const result = await caller.listAllUsers({ limit: 10, dir: 'desc' });

    for (let i = 0; i < result.items.length - 1; i++) {
      const current = result.items[i];
      const next = result.items[i + 1];
      if (current?.updatedAt && next?.updatedAt) {
        expect(new Date(current.updatedAt).getTime()).toBeGreaterThanOrEqual(
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

    // Search using "test" which is part of all test user emails
    // Email format: test-users-{task.id}-{role}-{randomSuffix}@{domain}
    const result = await caller.listAllUsers({
      limit: 100,
      q: task.id,
    });
    // Should find at least the admin user (all test users have "test" in email)
    console.log(result.items);
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
      q: 'xyznonexistent9999',
    });

    expect(result.items.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

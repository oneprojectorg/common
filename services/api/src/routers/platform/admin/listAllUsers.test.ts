import { GLOBAL_USER_IDS } from '@op/core';
import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

describeAccessTierGating('platform.admin.listAllUsers', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.listAllUsers(),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.listAllUsers(),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(caller.platform.admin.listAllUsers()).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.platform.admin.listAllUsers());
    },
  ),
});

describe.concurrent('platform.admin.listAllUsers', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  it('should successfully list all users as platform admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 2 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));
    const result = await caller.listAllUsers({ limit: 10 });

    // When running concurrently, other tests may create users too
    // Just verify that we got results and the API works
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it('should throw error when non-platform admin tries to list all users', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
      emailDomain: 'example.com',
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(() => caller.listAllUsers()).rejects.toThrow();
  });

  it('should support pagination with cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 3 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

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

  it('should return a next cursor when more pages exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 5 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Use a small limit to test pagination logic
    const smallLimit = await caller.listAllUsers({ limit: 2 });

    // With only 2 users per page and 6 users created, should have more
    expect(smallLimit.next).not.toBeNull();
    expect(smallLimit.items.length).toBeLessThanOrEqual(2);
  });

  it('should handle invalid cursor gracefully', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(() =>
      caller.listAllUsers({ limit: 10, cursor: 'invalid-cursor' }),
    ).rejects.toThrow();
  });

  it('should respect limit parameter', async ({ task, onTestFinished }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 5 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));
    const result = await caller.listAllUsers({ limit: 3 });

    expect(result.items.length).toBeLessThanOrEqual(3);
  });

  it('should sort users by createdAt ascending', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 3 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));
    const result = await caller.listAllUsers({ limit: 10, dir: 'asc' });

    for (let i = 0; i < result.items.length - 1; i++) {
      const current = result.items[i];
      const next = result.items[i + 1];
      if (current?.createdAt && next?.createdAt) {
        expect(new Date(current.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(next.createdAt).getTime(),
        );
      }
    }
  });

  it('should filter users by search query matching specific email', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 2 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

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
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Search with a very specific string that shouldn't match any users
    const result = await caller.listAllUsers({
      limit: 10,
      query: 'xyznonexistent9999',
    });

    expect(result.items.length).toBe(0);
    expect(result.next).toBeNull();
  });

  it('should support prefix matching in email search', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser, adminUsers, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 2 },
      });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

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

  it('should handle pagination with domain search', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // 2 oneproject.org users
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 1 },
      emailDomain: 'oneproject.org',
    });

    // 10 custom-domain.com users
    const { adminUser: customDomainAdmin, memberUsers: customDomainMembers } =
      await testData.createOrganization({
        users: { admin: 1, member: 9 },
        emailDomain: 'custom-domain.com',
      });

    const customDomainUserEmails = new Set([
      customDomainAdmin.email,
      ...customDomainMembers.map((u) => u.email),
    ]);

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Search by domain name
    const result = await caller.listAllUsers({
      limit: 5,
      query: 'custom-domain.com',
    });

    // Should find users with @custom-domain.com emails only, first page
    expect(result).toMatchObject({
      next: expect.any(String),
      total: 10,
    });
    expect(result.items).toSatisfy((items: typeof result.items) => {
      const satisfies = items.every((user: (typeof result.items)[number]) =>
        customDomainUserEmails.has(user.email!),
      );

      items.forEach((user: (typeof result.items)[number]) => {
        customDomainUserEmails.delete(user.email!);
      });

      return satisfies;
    });

    // Should find users with @custom-domain.com emails only, second page
    const result2 = await caller.listAllUsers({
      cursor: result.next!,
      limit: 5,
      query: 'custom-domain.com',
    });

    // Should find users with @custom-domain.com emails only
    expect(result2).toMatchObject({
      next: null,
      total: 10,
    });
    expect(result2.items).toSatisfy((items: typeof result2.items) =>
      items.every((user: (typeof result2.items)[number]) =>
        customDomainUserEmails.has(user.email!),
      ),
    );
  });

  it('finds and displays a user by auth.users email when public.users.email is NULL', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser, memberUsers } = await testData.createOrganization({
      users: { admin: 1, member: 1 },
    });
    const member = memberUsers[0]!;

    // Simulate the anonymous-upgrade bug: email lives on auth.users but
    // public.users.email is NULL.
    await db
      .update(users)
      .set({ email: null })
      .where(eq(users.authUserId, member.authUserId));

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listAllUsers({ limit: 100, query: task.id });

    const found = result.items.find(
      (user) => user.authUserId === member.authUserId,
    );
    expect(found).toBeDefined();
    expect(found?.email).toBe(member.email);
  });

  it('should never surface the global sentinel users', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create isolated session for this test
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const sentinelIds = new Set<string>(GLOBAL_USER_IDS);

    // The sentinels are seeded before any test user, so ascending order by
    // createdAt would surface them first if they weren't filtered out.
    const result = await caller.listAllUsers({ limit: 100, dir: 'asc' });

    expect(result.items.some((user) => sentinelIds.has(user.authUserId))).toBe(
      false,
    );
  });
});

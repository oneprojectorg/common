import { EntityType } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import profileRouter from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('profile.list', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should return profiles with pagination cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.list({
      limit: 10,
      types: [EntityType.ORG],
    });

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('next');
    expect(result).not.toHaveProperty('hasMore');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should return next cursor when more items exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create 3 organizations
    const [{ adminUser }] = await Promise.all([
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
    ]);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Request only 1 item - should have next cursor
    const result = await caller.list({
      limit: 1,
      types: [EntityType.ORG],
    });

    expect(result.items.length).toBe(1);
    expect(result.next).not.toBeNull();
    expect(typeof result.next).toBe('string');
  });

  it('should support cursor-based pagination to fetch next page', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create 3 organizations
    const [{ adminUser }] = await Promise.all([
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
    ]);

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First page: get 2 items
    const page1 = await caller.list({
      limit: 2,
      types: [EntityType.ORG],
    });

    expect(page1.items.length).toBe(2);
    expect(page1.next).not.toBeNull();

    // Second page: use cursor to get remaining items
    const page2 = await caller.list({
      limit: 2,
      cursor: page1.next,
      types: [EntityType.ORG],
    });

    expect(page2.items.length).toBeGreaterThanOrEqual(1);

    // Ensure no duplicate items between pages
    const page1Ids = page1.items.map((item) => item.id);
    const page2Ids = page2.items.map((item) => item.id);
    const overlap = page1Ids.filter((id) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('should return null next cursor when no more items', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Request more items than exist
    const result = await caller.list({
      limit: 1000,
      types: [EntityType.ORG],
    });

    // When we've fetched all items, next should be null
    expect(result.next).toBeNull();
  });
});

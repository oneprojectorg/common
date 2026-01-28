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

  it('should return response structure without hasMore property', async ({
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

  it('should include created profiles in paginated results', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create organizations - each has an associated profile
    const [org1, org2, org3] = await Promise.all([
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
    ]);

    const createdProfileIds = new Set([
      org1.organization.profileId,
      org2.organization.profileId,
      org3.organization.profileId,
    ]);

    const { session } = await createIsolatedSession(org1.adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Paginate through results to find our created profiles
    const foundProfileIds = new Set<string>();
    let cursor: string | null | undefined = undefined;
    let pageCount = 0;
    const maxPages = 100; // Safety limit

    while (pageCount < maxPages) {
      const result = await caller.list({
        limit: 10,
        cursor,
        types: [EntityType.ORG],
      });

      for (const item of result.items) {
        if (createdProfileIds.has(item.id)) {
          foundProfileIds.add(item.id);
        }
      }

      // Stop if we found all our profiles or no more pages
      if (foundProfileIds.size === createdProfileIds.size || !result.next) {
        break;
      }

      cursor = result.next;
      pageCount++;
    }

    // Verify all created profiles were found
    expect(foundProfileIds.size).toBe(createdProfileIds.size);
  });

  it('should not return duplicate items across pages', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Collect IDs across multiple pages
    const allIds: string[] = [];
    let cursor: string | null | undefined = undefined;
    let pageCount = 0;
    const maxPages = 10; // Check first 10 pages

    while (pageCount < maxPages) {
      const result = await caller.list({
        limit: 5,
        cursor,
        types: [EntityType.ORG],
      });

      allIds.push(...result.items.map((item) => item.id));

      if (!result.next) {
        break;
      }

      cursor = result.next;
      pageCount++;
    }

    // Verify no duplicates
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('should eventually return null next cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Paginate until we reach the end
    let cursor: string | null | undefined = undefined;
    let reachedEnd = false;
    let pageCount = 0;
    const maxPages = 1000; // Safety limit

    while (pageCount < maxPages) {
      const result = await caller.list({
        limit: 100,
        cursor,
        types: [EntityType.ORG],
      });

      if (result.next === null) {
        reachedEnd = true;
        break;
      }

      cursor = result.next;
      pageCount++;
    }

    expect(reachedEnd).toBe(true);
  });
});

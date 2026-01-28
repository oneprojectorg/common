import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('organization.list', () => {
  const createCaller = createCallerFactory(organizationRouter);

  it('should return paginated response structure', async ({
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
    });

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('next');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should include created organizations in paginated results', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create multiple organizations
    const [org1, org2, org3] = await Promise.all([
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
    ]);

    const createdOrgIds = new Set([
      org1.organization.id,
      org2.organization.id,
      org3.organization.id,
    ]);

    const { session } = await createIsolatedSession(org1.adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Paginate through results to find our created organizations
    const foundOrgIds = new Set<string>();
    let cursor: string | null | undefined = undefined;
    let pageCount = 0;
    const maxPages = 100; // Safety limit

    while (pageCount < maxPages) {
      const result = await caller.list({
        limit: 10,
        cursor,
      });

      for (const item of result.items) {
        if (createdOrgIds.has(item.id)) {
          foundOrgIds.add(item.id);
        }
      }

      // Stop if we found all our orgs or no more pages
      if (foundOrgIds.size === createdOrgIds.size || !result.next) {
        break;
      }

      cursor = result.next;
      pageCount++;
    }

    // Verify all created organizations were found
    expect(foundOrgIds.size).toBe(createdOrgIds.size);
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

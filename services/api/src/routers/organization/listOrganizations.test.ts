import { db } from '@op/db/client';
import { links, organizations, projects } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
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

  it('should include created organizations in results', async ({
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

    const result = await caller.list({
      limit: 1000,
    });

    const foundOrgIds = result.items
      .filter((item) => createdOrgIds.has(item.id))
      .map((item) => item.id);

    expect(foundOrgIds.length).toBe(createdOrgIds.size);
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

  it('returns organizations in the requested sort order after the two-step hydration', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const [orgA, orgB, orgC] = await Promise.all([
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
      testData.createOrganization({ users: { admin: 1 } }),
    ]);

    // Pin distinct, far-future createdAt values so these three sort to the top
    // regardless of other concurrent test data, giving a known expected order.
    await Promise.all([
      db
        .update(organizations)
        .set({ createdAt: '2999-01-01T00:00:00.000Z' })
        .where(eq(organizations.id, orgA.organization.id)),
      db
        .update(organizations)
        .set({ createdAt: '2999-01-02T00:00:00.000Z' })
        .where(eq(organizations.id, orgB.organization.id)),
      db
        .update(organizations)
        .set({ createdAt: '2999-01-03T00:00:00.000Z' })
        .where(eq(organizations.id, orgC.organization.id)),
    ]);

    const { session } = await createIsolatedSession(orgA.adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.list({
      limit: 100,
      orderBy: 'createdAt',
      dir: 'desc',
    });

    const ourIds = new Set([
      orgA.organization.id,
      orgB.organization.id,
      orgC.organization.id,
    ]);
    const orderedOurIds = result.items
      .map((item) => item.id)
      .filter((id) => ourIds.has(id));

    // Newest createdAt first; the second-stage `in` hydration must be re-ordered
    // back to the paged order, not left in arbitrary DB order.
    expect(orderedOurIds).toEqual([
      orgC.organization.id,
      orgB.organization.id,
      orgA.organization.id,
    ]);
  });

  it('preserves the nested relation shape (projects, links, whereWeWork, profile) after hydration', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const [project] = await db
      .insert(projects)
      .values({
        name: 'Two-step project',
        slug: `two-step-project-${organization.id}`,
        organizationId: organization.id,
      })
      .returning({ id: projects.id });
    const [link] = await db
      .insert(links)
      .values({
        href: 'https://example.com/two-step',
        organizationId: organization.id,
      })
      .returning({ id: links.id });

    // projects FK is ON DELETE SET NULL, so the org cascade won't remove it —
    // clean it up explicitly. links cascade with the org.
    onTestFinished(async () => {
      await db.delete(projects).where(eq(projects.id, project!.id));
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.list({ limit: 1000 });
    const found = result.items.find((item) => item.id === organization.id);

    expect(found).toBeDefined();
    expect(found?.projects?.some((p) => p.id === project!.id)).toBe(true);
    expect(found?.links.some((l) => l.id === link!.id)).toBe(true);
    // whereWeWork must be flattened to a locations array, never undefined.
    expect(Array.isArray(found?.whereWeWork)).toBe(true);
    expect(found?.profile).toBeDefined();
  });
});

describeAccessTierGating('organization.list', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.organization.list(), 'none');
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(caller.organization.list(), 'anon');
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(caller.organization.list(), 'user');
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.organization.list());
    },
  ),
});

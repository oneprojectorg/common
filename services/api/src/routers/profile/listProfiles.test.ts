import { TestOrganizationDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import {
  EntityType,
  organizationsStrategies,
  organizationsTerms,
  profiles,
  taxonomyTerms,
} from '@op/db/schema';
import { inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import profileRouter from '.';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('profile.list', () => {
  const createCaller = createCallerFactory(profileRouter);

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
      types: [EntityType.ORG],
    });

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('next');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should include created profiles in results', async ({
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

    const result = await caller.list({
      limit: 1000,
      types: [EntityType.ORG],
    });

    const foundProfileIds = result.items
      .filter((item) => createdProfileIds.has(item.id))
      .map((item) => item.id);

    expect(foundProfileIds.length).toBe(createdProfileIds.size);
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

  describe('term filters and ordering', () => {
    /** One focus-area term and one strategy term, removed after the test. */
    const createTerms = async (
      taskId: string,
      onTestFinished: (fn: () => Promise<void>) => void,
    ) => {
      const [focusArea, strategy] = await db
        .insert(taxonomyTerms)
        .values([
          {
            termUri: `test:focus:${taskId}`,
            label: `Test Focus ${taskId}`,
            facet: 'focusArea',
          },
          {
            termUri: `test:strategy:${taskId}`,
            label: `Test Strategy ${taskId}`,
            facet: 'strategy',
          },
        ])
        .returning({ id: taxonomyTerms.id });
      if (!focusArea || !strategy) {
        throw new Error('Failed to insert taxonomy term fixtures');
      }
      // Deleting a term cascades to organizations_terms/_strategies.
      onTestFinished(async () => {
        await db
          .delete(taxonomyTerms)
          .where(inArray(taxonomyTerms.id, [focusArea.id, strategy.id]));
      });
      return { focusAreaId: focusArea.id, strategyId: strategy.id };
    };

    it('returns only organizations tagged with the focus area', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { focusAreaId } = await createTerms(task.id, onTestFinished);
      const [tagged, untagged] = await Promise.all([
        testData.createOrganization({ users: { admin: 1 } }),
        testData.createOrganization({ users: { admin: 1 } }),
      ]);
      await db.insert(organizationsTerms).values({
        organizationId: tagged.organization.id,
        taxonomyTermId: focusAreaId,
      });

      const { session } = await createIsolatedSession(tagged.adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));
      const result = await caller.list({
        limit: 100,
        types: [EntityType.ORG],
        focusAreaIds: [focusAreaId],
      });

      expect(result.items.map((item) => item.id)).toEqual([
        tagged.organization.profileId,
      ]);
      expect(result.items.map((item) => item.id)).not.toContain(
        untagged.organization.profileId,
      );
    });

    it('returns only organizations tagged with the strategy', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { strategyId } = await createTerms(task.id, onTestFinished);
      const [tagged] = await Promise.all([
        testData.createOrganization({ users: { admin: 1 } }),
        testData.createOrganization({ users: { admin: 1 } }),
      ]);
      await db.insert(organizationsStrategies).values({
        organizationId: tagged.organization.id,
        taxonomyTermId: strategyId,
      });

      const { session } = await createIsolatedSession(tagged.adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));
      const result = await caller.list({
        limit: 100,
        types: [EntityType.ORG],
        strategyIds: [strategyId],
      });

      expect(result.items.map((item) => item.id)).toEqual([
        tagged.organization.profileId,
      ]);
    });

    it('requires both filters when both are given', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { focusAreaId, strategyId } = await createTerms(
        task.id,
        onTestFinished,
      );
      const [both, focusOnly] = await Promise.all([
        testData.createOrganization({ users: { admin: 1 } }),
        testData.createOrganization({ users: { admin: 1 } }),
      ]);
      await db.insert(organizationsTerms).values([
        { organizationId: both.organization.id, taxonomyTermId: focusAreaId },
        {
          organizationId: focusOnly.organization.id,
          taxonomyTermId: focusAreaId,
        },
      ]);
      await db.insert(organizationsStrategies).values({
        organizationId: both.organization.id,
        taxonomyTermId: strategyId,
      });

      const { session } = await createIsolatedSession(both.adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));
      const result = await caller.list({
        limit: 100,
        types: [EntityType.ORG],
        focusAreaIds: [focusAreaId],
        strategyIds: [strategyId],
      });

      expect(result.items.map((item) => item.id)).toEqual([
        both.organization.profileId,
      ]);
    });

    it('pages through equal creation times without repeating or skipping', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { focusAreaId } = await createTerms(task.id, onTestFinished);
      const orgs = await Promise.all([
        testData.createOrganization({ users: { admin: 1 } }),
        testData.createOrganization({ users: { admin: 1 } }),
        testData.createOrganization({ users: { admin: 1 } }),
      ]);
      // Scope the listing to these three, then give them one timestamp so
      // only the id tie-breaker can order them.
      await db.insert(organizationsTerms).values(
        orgs.map(({ organization }) => ({
          organizationId: organization.id,
          taxonomyTermId: focusAreaId,
        })),
      );
      const profileIds = orgs.map(({ organization }) => organization.profileId);
      await db
        .update(profiles)
        .set({ createdAt: '2026-01-01T00:00:00.000Z' })
        .where(inArray(profiles.id, profileIds));

      const [firstOrg] = orgs;
      if (!firstOrg) {
        throw new Error('Failed to create organizations');
      }
      const { session } = await createIsolatedSession(firstOrg.adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page: Awaited<ReturnType<typeof caller.list>> = await caller.list(
          {
            limit: 1,
            types: [EntityType.ORG],
            focusAreaIds: [focusAreaId],
            orderBy: 'createdAt',
            dir: 'desc',
            cursor,
          },
        );
        seen.push(...page.items.map((item) => item.id));
        cursor = page.next;
      } while (cursor && seen.length <= profileIds.length);

      expect(seen).toHaveLength(profileIds.length);
      expect(new Set(seen)).toEqual(new Set(profileIds));
    });
  });
});

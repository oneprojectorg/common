import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { listJoinProfileRequestsRouter } from './listJoinProfileRequests';

describe.concurrent('profile.listJoinProfileRequests', () => {
  const createCaller = createCallerFactory(listJoinProfileRequestsRouter);

  it('should return an empty list when no join requests exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile, adminUser } =
      await testData.createOrganization({
        users: { admin: 1 },
      });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listJoinProfileRequests({
      targetProfileId: organizationProfile.id,
    });

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.next).toBeNull();
  });

  it('should list join requests for a target profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization({
        users: { admin: 1 },
      });
    const { adminUser: requester } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create a join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Clean up join request after test
    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(
          and(
            eq(joinProfileRequests.requestProfileId, requester.profileId),
            eq(joinProfileRequests.targetProfileId, targetProfile.id),
          ),
        );
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.requestProfileId).toBe(requester.profileId);
    expect(result.items[0]?.targetProfileId).toBe(targetProfile.id);
    expect(result.items[0]?.status).toBe(JoinProfileRequestStatus.PENDING);
    expect(result.items[0]?.requestProfile).toBeDefined();
    expect(result.hasMore).toBe(false);
  });

  it('should filter join requests by status', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization({
        users: { admin: 1 },
      });
    const { adminUser: requester1 } = await testData.createOrganization({
      users: { admin: 1 },
    });
    const { adminUser: requester2 } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create join requests with different statuses
    await db.insert(joinProfileRequests).values([
      {
        requestProfileId: requester1.profileId,
        targetProfileId: targetProfile.id,
        status: JoinProfileRequestStatus.PENDING,
      },
      {
        requestProfileId: requester2.profileId,
        targetProfileId: targetProfile.id,
        status: JoinProfileRequestStatus.APPROVED,
      },
    ]);

    // Clean up join requests after test
    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(eq(joinProfileRequests.targetProfileId, targetProfile.id));
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Filter by pending status
    const pendingResult = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    expect(pendingResult.items).toHaveLength(1);
    expect(pendingResult.items[0]?.status).toBe(
      JoinProfileRequestStatus.PENDING,
    );

    // Filter by approved status
    const approvedResult = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    expect(approvedResult.items).toHaveLength(1);
    expect(approvedResult.items[0]?.status).toBe(
      JoinProfileRequestStatus.APPROVED,
    );
  });

  it('should paginate results correctly', async ({ task, onTestFinished }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization({
        users: { admin: 1 },
      });

    // Create multiple requesters
    const requesters = await Promise.all(
      Array.from({ length: 3 }, () =>
        testData
          .createOrganization({ users: { admin: 1 } })
          .then((r) => r.adminUser),
      ),
    );

    // Create join requests
    for (const requester of requesters) {
      await db.insert(joinProfileRequests).values({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
      });
    }

    // Clean up join requests after test
    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(eq(joinProfileRequests.targetProfileId, targetProfile.id));
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Get first page with limit of 2
    const firstPage = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      limit: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.next).toBeDefined();

    // Get second page using cursor
    const secondPage = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      limit: 2,
      cursor: firstPage.next,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);

    // Ensure no duplicate items across pages
    const allIds = [
      ...firstPage.items.map((i) => i.id),
      ...secondPage.items.map((i) => i.id),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(3);
  });

  it('should only return requests for the specified target profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile: targetProfile1, adminUser: targetAdmin1 } =
      await testData.createOrganization({
        users: { admin: 1 },
      });
    const { organizationProfile: targetProfile2 } =
      await testData.createOrganization({
        users: { admin: 1 },
      });
    const { adminUser: requester } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create join requests to both targets
    await db.insert(joinProfileRequests).values([
      {
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile1.id,
      },
      {
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile2.id,
      },
    ]);

    // Clean up join requests after test
    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(eq(joinProfileRequests.requestProfileId, requester.profileId));
    });

    const { session } = await createIsolatedSession(targetAdmin1.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile1.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.targetProfileId).toBe(targetProfile1.id);
  });
});

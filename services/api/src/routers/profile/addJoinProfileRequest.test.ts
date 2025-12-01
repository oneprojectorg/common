import { db } from '@op/db/client';
import { joinProfileRequests } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { addJoinProfileRequestRouter } from './addJoinProfileRequest';

describe.concurrent('profile.addJoinProfileRequest', () => {
  const createCaller = createCallerFactory(addJoinProfileRequestRouter);

  it('should create a new join profile request with pending status', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create two organizations to get two different profiles
    const { adminUser: requester } = await testData.createOrganization({
      users: { admin: 1 },
    });
    const { organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
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

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Call the API endpoint
    const result = await caller.addJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(result).toEqual({ success: true });

    // Verify the request was created with pending status
    const [request] = await db
      .select()
      .from(joinProfileRequests)
      .where(
        and(
          eq(joinProfileRequests.requestProfileId, requester.profileId),
          eq(joinProfileRequests.targetProfileId, targetProfile.id),
        ),
      );

    expect(request).toBeDefined();
    expect(request?.status).toBe('pending');
    expect(request?.requestProfileId).toBe(requester.profileId);
    expect(request?.targetProfileId).toBe(targetProfile.id);
  });

  it('should prevent duplicate requests from the same profile to the same target', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization({
      users: { admin: 1 },
    });
    const { organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
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

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Create first request
    await caller.addJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Attempt to create duplicate request should throw
    await expect(
      caller.addJoinProfileRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('should prevent self-requests', async ({ task, onTestFinished }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    // Create session as the user
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempting to request to join own profile should throw
    await expect(
      caller.addJoinProfileRequest({
        requestProfileId: adminUser.profileId,
        targetProfileId: adminUser.profileId,
      }),
    ).rejects.toThrow('Cannot request to join your own profile');
  });
});

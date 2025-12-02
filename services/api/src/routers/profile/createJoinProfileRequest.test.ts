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
import { createJoinProfileRequestRouter } from './createJoinProfileRequest';

describe.concurrent('profile.createJoinProfileRequest', () => {
  const createCaller = createCallerFactory(createJoinProfileRequestRouter);

  it('should create a new join profile request with pending status', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create two organizations to get two different profiles
    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

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
    const result = await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Verify the returned status and profiles
    expect(result.status).toBe('pending');
    expect(result.requestProfile.id).toBe(requester.profileId);
    expect(result.targetProfile.id).toBe(targetProfile.id);
  });

  it('should prevent duplicate requests from the same profile to the same target', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

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
    await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Attempt to create duplicate request should throw
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('should prevent self-requests', async ({ task, onTestFinished }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization();

    // Create session as the user
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempting to request to join own profile should throw
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: adminUser.profileId,
        targetProfileId: adminUser.profileId,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should reset rejected request to pending status with updated dates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

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

    // Create initial request
    await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Manually set the request to rejected status
    await db
      .update(joinProfileRequests)
      .set({ status: JoinProfileRequestStatus.REJECTED })
      .where(
        and(
          eq(joinProfileRequests.requestProfileId, requester.profileId),
          eq(joinProfileRequests.targetProfileId, targetProfile.id),
        ),
      );

    // Create a new request - should reset to pending
    const result = await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Verify the returned status
    expect(result.status).toBe('pending');
  });

  it('should prevent an org profile to request to join another org profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create two organizations - we'll use their org profiles (not user profiles)
    const { organizationProfile: requesterOrgProfile, adminUser } =
      await testData.createOrganization();
    const { organizationProfile: targetOrgProfile } =
      await testData.createOrganization();

    // Create session as the admin user
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempting to create a request from one org profile to another org profile should throw
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: requesterOrgProfile.id,
        targetProfileId: targetOrgProfile.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

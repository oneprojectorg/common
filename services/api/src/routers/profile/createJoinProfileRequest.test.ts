import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../test/helpers/TestJoinProfileRequestDataManager';
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
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create two organizations to get two different profiles
    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Call the API endpoint
    const result = await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Track the created join request for cleanup
    joinRequestData.trackJoinRequest(result.id);

    // Verify the returned fields
    expect(result.id).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.requestProfileId).toBe(requester.profileId);
    expect(result.targetProfileId).toBe(targetProfile.id);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();

    // Verify the returned profiles
    expect(result.requestProfile.id).toBe(requester.profileId);
    expect(result.targetProfile.id).toBe(targetProfile.id);
  });

  it('should prevent duplicate requests from the same profile to the same target', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Create first request
    const result = await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Track the created join request for cleanup
    joinRequestData.trackJoinRequest(result.id);

    // Attempt to create duplicate request should throw
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });
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
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should reset rejected request to pending status with updated dates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Create initial request
    const initialResult = await caller.createJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Track the created join request for cleanup
    joinRequestData.trackJoinRequest(initialResult.id);

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

    // Verify the returned fields including updated timestamp
    expect(result.id).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.requestProfileId).toBe(requester.profileId);
    expect(result.targetProfileId).toBe(targetProfile.id);
    expect(result.updatedAt).toBeDefined();
  });

  it('should prevent org profiles from creating join requests', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create two organizations - we'll use their org profiles (not user profiles)
    const { organizationProfile: requesterOrgProfile, adminUser } =
      await testData.createOrganization();
    const { organizationProfile: targetOrgProfile } =
      await testData.createOrganization();

    // Create session as the admin user (who controls the requesterOrgProfile's org)
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempting to create a request from an org profile should throw ValidationError
    // because only individual/user profiles can make join requests
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: requesterOrgProfile.id,
        targetProfileId: targetOrgProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should prevent a user from creating a join request for a profile they do not belong to', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create three organizations:
    // - One for the unauthorized user (to get authenticated)
    // - One whose profile the unauthorized user will try to impersonate
    // - One that is the target
    const { adminUser: unauthorizedUser } = await testData.createOrganization();
    const { adminUser: otherUser } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    const { session } = await createIsolatedSession(unauthorizedUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Unauthorized user tries to create a join request on behalf of another user's profile
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: otherUser.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should prevent existing members from creating join requests', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create two organizations
    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile, organization: targetOrg } =
      await testData.createOrganization();

    // Add requester as a member of the target organization using the manager
    await joinRequestData.createOrganizationUserMembership({
      authUserId: requester.authUserId,
      organizationId: targetOrg.id,
      email: requester.email,
    });

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempting to create a join request should fail because user is already a member
    await expect(
      caller.createJoinProfileRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

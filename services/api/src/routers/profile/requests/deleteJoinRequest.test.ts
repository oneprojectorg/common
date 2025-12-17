import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../../test/helpers/TestJoinProfileRequestDataManager';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { deleteJoinRequestRouter } from './deleteJoinRequest';

describe.concurrent('profile.deleteJoinRequest', () => {
  const createCaller = createCallerFactory(deleteJoinRequestRouter);

  it('should allow requester to delete their own pending request', async ({
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

    // Create a pending join request
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Delete the request
    await caller.deleteJoinRequest({
      requestId: joinRequest.id,
    });

    // Verify the request was deleted
    const deletedRequest = await db.query.joinProfileRequests.findFirst({
      where: eq(joinProfileRequests.id, joinRequest.id),
    });

    expect(deletedRequest).toBeUndefined();
  });

  it('should prevent deleting an approved request', async ({
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

    // Create an approved join request
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempt to delete should fail
    await expect(
      caller.deleteJoinRequest({
        requestId: joinRequest.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should prevent deleting a rejected request', async ({
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

    // Create a rejected join request
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.REJECTED,
    });

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempt to delete should fail
    await expect(
      caller.deleteJoinRequest({
        requestId: joinRequest.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should prevent a non-owner from deleting another user request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: unauthorizedUser } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a pending join request from requester
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    // Unauthorized user tries to delete
    const { session } = await createIsolatedSession(unauthorizedUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.deleteJoinRequest({
        requestId: joinRequest.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should return error when join request does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Use a random UUID that doesn't exist
    const nonExistentRequestId = '00000000-0000-0000-0000-000000000000';

    await expect(
      caller.deleteJoinRequest({
        requestId: nonExistentRequestId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should prevent target profile admin from deleting a request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a pending join request
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    // Target admin tries to delete - should fail (only requester can cancel)
    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.deleteJoinRequest({
        requestId: joinRequest.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

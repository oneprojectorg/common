import { JoinProfileRequestStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../test/helpers/TestJoinProfileRequestDataManager';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { getJoinProfileRequestRouter } from './getJoinProfileRequest';

describe.concurrent('profile.getJoinProfileRequest', () => {
  const createCaller = createCallerFactory(getJoinProfileRequestRouter);

  it('should return null when no join request exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(result).toBeNull();
  });

  it('should return the join request with pending status', async ({
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

    // Create a join request using the manager
    await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe('pending');
    expect(result?.requestProfile.id).toBe(requester.profileId);
    expect(result?.targetProfile.id).toBe(targetProfile.id);
  });

  it('should return the join request with approved status', async ({
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

    // Create an approved join request using the manager
    await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe('approved');
  });

  it('should return the join request with rejected status', async ({
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

    // Create a rejected join request using the manager
    await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.REJECTED,
    });

    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe('rejected');
  });

  it('should prevent checking self-request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.getJoinProfileRequest({
        requestProfileId: adminUser.profileId,
        targetProfileId: adminUser.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should prevent org profile from checking join request to another org profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile: requesterOrgProfile, adminUser } =
      await testData.createOrganization();
    const { organizationProfile: targetOrgProfile } =
      await testData.createOrganization();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.getJoinProfileRequest({
        requestProfileId: requesterOrgProfile.id,
        targetProfileId: targetOrgProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should prevent a user from viewing a join request for a profile they do not belong to', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create three organizations:
    // - One for the unauthorized user (to get authenticated)
    // - One whose profile the unauthorized user will try to view
    // - One that is the target
    const { adminUser: unauthorizedUser } = await testData.createOrganization();
    const { adminUser: otherUser } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a join request from otherUser to target using the manager
    await joinRequestData.createJoinRequest({
      requestProfileId: otherUser.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(unauthorizedUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Unauthorized user tries to view another user's join request
    await expect(
      caller.getJoinProfileRequest({
        requestProfileId: otherUser.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

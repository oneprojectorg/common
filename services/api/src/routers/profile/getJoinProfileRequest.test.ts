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

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a join request directly in the database
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
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

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create an approved join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

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

    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a rejected join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.REJECTED,
    });

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
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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

    // This returns FORBIDDEN because the user doesn't own the org profile
    // (auth check runs before profile type validation)
    await expect(
      caller.getJoinProfileRequest({
        requestProfileId: requesterOrgProfile.id,
        targetProfileId: targetOrgProfile.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('should prevent a user from viewing a join request for a profile they do not belong to', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create three organizations:
    // - One where the attacker is a member (to get authenticated)
    // - One whose profile the attacker will try to view
    // - One that is the target
    const { adminUser: attacker } = await testData.createOrganization();
    const { adminUser: victim } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a join request from victim to target
    await db.insert(joinProfileRequests).values({
      requestProfileId: victim.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(
          and(
            eq(joinProfileRequests.requestProfileId, victim.profileId),
            eq(joinProfileRequests.targetProfileId, targetProfile.id),
          ),
        );
    });

    // Create session as the attacker
    const { session } = await createIsolatedSession(attacker.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attacker tries to view victim's join request
    await expect(
      caller.getJoinProfileRequest({
        requestProfileId: victim.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

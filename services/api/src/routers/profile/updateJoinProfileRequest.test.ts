import { db } from '@op/db/client';
import {
  JoinProfileRequestStatus,
  joinProfileRequests,
  profileUsers,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { updateJoinProfileRequestRouter } from './updateJoinProfileRequest';

describe.concurrent('profile.updateJoinProfileRequest', () => {
  const createCaller = createCallerFactory(updateJoinProfileRequestRouter);

  it('should allow target profile admin to approve a pending request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Insert a pending join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    // Clean up
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

    const result = await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'approved',
    });

    expect(result.status).toBe('approved');
    expect(result.targetProfile.id).toBe(targetProfile.id);
  });

  it('should allow target profile admin to reject a pending request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Insert a pending join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
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

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'rejected',
    });

    expect(result.status).toBe('rejected');
  });

  it('should prevent a non-member from updating the request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: unauthorizedUser } = await testData.createOrganization();
    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a request from requester to target
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
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

    const { session } = await createIsolatedSession(unauthorizedUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateJoinProfileRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
        status: 'approved',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('should return BAD_REQUEST when join request does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();
    const { adminUser: requester } = await testData.createOrganization();

    // Ensure there's no join request in DB for this pair
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

    await expect(
      caller.updateJoinProfileRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
        status: 'approved',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should be idempotent when updating to the same status', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Insert an approved join request
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

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'approved',
    });

    expect(result.status).toBe('approved');
  });

  it('should create profile membership when request is approved', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Insert a pending join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    // Clean up join request and any created profile membership
    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(
          and(
            eq(joinProfileRequests.requestProfileId, requester.profileId),
            eq(joinProfileRequests.targetProfileId, targetProfile.id),
          ),
        );
      await db
        .delete(profileUsers)
        .where(
          and(
            eq(profileUsers.authUserId, requester.authUserId),
            eq(profileUsers.profileId, targetProfile.id),
          ),
        );
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'approved',
    });

    expect(result.status).toBe('approved');

    // Verify that the profile membership was created
    const membership = await db.query.profileUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.profileId, targetProfile.id),
        ),
    });

    expect(membership).toBeDefined();
    expect(membership?.authUserId).toBe(requester.authUserId);
    expect(membership?.profileId).toBe(targetProfile.id);
  });

  it('should assign Member role when creating profile membership on approval', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Insert a pending join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    // Clean up
    onTestFinished(async () => {
      await db
        .delete(joinProfileRequests)
        .where(
          and(
            eq(joinProfileRequests.requestProfileId, requester.profileId),
            eq(joinProfileRequests.targetProfileId, targetProfile.id),
          ),
        );
      await db
        .delete(profileUsers)
        .where(
          and(
            eq(profileUsers.authUserId, requester.authUserId),
            eq(profileUsers.profileId, targetProfile.id),
          ),
        );
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'approved',
    });

    // Verify the membership was created with the Member role
    const membership = await db.query.profileUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.profileId, targetProfile.id),
        ),
      with: {
        roles: {
          with: {
            accessRole: true,
          },
        },
      },
    });

    // TODO: We should find a better way to reference the Member role
    // rather than querying by name. Consider using a constant ID or
    // a more robust role resolution mechanism.
    expect(membership).toBeDefined();
    expect(membership?.roles).toHaveLength(1);
    expect(membership?.roles[0]?.accessRole?.name).toBe('Member');
  });

  it('should not create profile membership when request is rejected', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Insert a pending join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
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

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'rejected',
    });

    expect(result.status).toBe('rejected');

    // Verify that no profile membership was created
    const membership = await db.query.profileUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.profileId, targetProfile.id),
        ),
    });

    expect(membership).toBeUndefined();
  });

  it('should not create duplicate membership if user is already a member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser: requester } = await testData.createOrganization();
    const { adminUser: targetAdmin, organizationProfile: targetProfile } =
      await testData.createOrganization();

    // First, create an existing membership for the requester in the target profile
    const [existingMembership] = await db
      .insert(profileUsers)
      .values({
        authUserId: requester.authUserId,
        profileId: targetProfile.id,
        email: requester.email,
        name: 'Existing Member',
      })
      .returning();

    // Insert a pending join request
    await db.insert(joinProfileRequests).values({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
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
      await db
        .delete(profileUsers)
        .where(
          and(
            eq(profileUsers.authUserId, requester.authUserId),
            eq(profileUsers.profileId, targetProfile.id),
          ),
        );
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinProfileRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: 'approved',
    });

    expect(result.status).toBe('approved');

    // Verify there's still only one membership (the existing one)
    const memberships = await db.query.profileUsers.findMany({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.profileId, targetProfile.id),
        ),
    });

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.id).toBe(existingMembership?.id);
  });
});

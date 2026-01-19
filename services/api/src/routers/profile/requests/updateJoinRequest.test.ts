import { db } from '@op/db/client';
import { JoinProfileRequestStatus, organizations } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../../test/helpers/TestJoinProfileRequestDataManager';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { updateJoinRequestRouter } from './updateJoinRequest';

describe.concurrent('profile.updateJoinRequest', () => {
  const createCaller = createCallerFactory(updateJoinRequestRouter);

  it('should allow target profile admin to approve a pending request', async ({
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

    // Insert a pending join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    expect(result.status).toBe(JoinProfileRequestStatus.APPROVED);
    expect(result.targetProfile.id).toBe(targetProfile.id);
  });

  it('should allow target profile admin to reject a pending request', async ({
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

    // Insert a pending join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.REJECTED,
    });

    expect(result.status).toBe(JoinProfileRequestStatus.REJECTED);
  });

  it('should prevent a non-member from updating the request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { adminUser: unauthorizedUser } = await testData.createOrganization();
    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create a request from requester to target using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(unauthorizedUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateJoinRequest({
        requestId: joinRequest.id,
        status: JoinProfileRequestStatus.APPROVED,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should return BAD_REQUEST when join request does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    await testData.createOrganization();

    const { session } = await createIsolatedSession(
      (await testData.createOrganization()).adminUser.email,
    );
    const caller = createCaller(await createTestContextWithSession(session));

    // Use a random UUID that doesn't exist
    const nonExistentRequestId = '00000000-0000-0000-0000-000000000000';

    await expect(
      caller.updateJoinRequest({
        requestId: nonExistentRequestId,
        status: JoinProfileRequestStatus.APPROVED,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('should be idempotent when updating to the same status', async ({
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

    // Insert an approved join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    expect(result.status).toBe(JoinProfileRequestStatus.APPROVED);
  });

  it('should create profile membership when request is approved', async ({
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

    // Insert a pending join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    // Get the organization for the target profile
    const targetOrg = await db._query.organizations.findFirst({
      where: eq(organizations.profileId, targetProfile.id),
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    expect(result.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Verify that the organization membership was created
    const membership = await db._query.organizationUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.organizationId, targetOrg!.id),
        ),
    });

    expect(membership).toBeDefined();
    expect(membership?.authUserId).toBe(requester.authUserId);
    expect(membership?.organizationId).toBe(targetOrg!.id);
  });

  it('should assign Member role when creating organization membership on approval', async ({
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

    // Get the organization for the target profile
    const targetOrg = await db._query.organizations.findFirst({
      where: eq(organizations.profileId, targetProfile.id),
    });

    // Insert a pending join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    // Verify the membership was created with the Member role
    const membership = await db._query.organizationUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.organizationId, targetOrg!.id),
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

  it('should not create organization membership when request is rejected', async ({
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

    // Get the organization for the target profile
    const targetOrg = await db._query.organizations.findFirst({
      where: eq(organizations.profileId, targetProfile.id),
    });

    // Insert a pending join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.REJECTED,
    });

    expect(result.status).toBe(JoinProfileRequestStatus.REJECTED);

    // Verify that no organization membership was created
    const membership = await db._query.organizationUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.organizationId, targetOrg!.id),
        ),
    });

    expect(membership).toBeUndefined();
  });

  it('should not create duplicate membership if user is already a member', async ({
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

    // Get the organization for the target profile
    const targetOrg = await db._query.organizations.findFirst({
      where: eq(organizations.profileId, targetProfile.id),
    });

    // First, create an existing membership for the requester in the target organization
    const existingMembership = await testData.addUserToOrganization({
      authUserId: requester.authUserId,
      organizationId: targetOrg!.id,
      email: requester.email,
    });

    // Insert a pending join request using the manager
    const { joinRequest } = await joinRequestData.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateJoinRequest({
      requestId: joinRequest.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    expect(result.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Verify there's still only one membership (the existing one)
    const memberships = await db._query.organizationUsers.findMany({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, requester.authUserId),
          eq(table.organizationId, targetOrg!.id),
        ),
    });

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.id).toBe(existingMembership.id);
  });
});

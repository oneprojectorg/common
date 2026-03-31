import { db } from '@op/db/client';
import {
  JoinProfileRequestStatus,
  accessRoles,
  joinProfileRequests,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../../test/helpers/TestJoinProfileRequestDataManager';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';
import { createJoinRequestRouter } from './createJoinRequest';

describe.concurrent('profile.createJoinRequest', () => {
  const createCaller = createCallerFactory(createJoinRequestRouter);

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
    const result = await caller.createJoinRequest({
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

  it('should return existing pending request when re-submitting', async ({
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
    const result = await caller.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    // Track the created join request for cleanup
    joinRequestData.trackJoinRequest(result.id);

    // Re-submitting returns the existing pending request
    const second = await caller.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(second.id).toBe(result.id);
    expect(second.status).toBe('pending');
  });

  it('should prevent self-requests', async ({ task, onTestFinished }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization();

    // Create session as the user
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Attempting to request to join own profile should throw
    await expect(
      caller.createJoinRequest({
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
    const initialResult = await caller.createJoinRequest({
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
    const result = await caller.createJoinRequest({
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
      caller.createJoinRequest({
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
      caller.createJoinRequest({
        requestProfileId: otherUser.profileId,
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should return approved request for existing members instead of erroring', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create two organizations
    const { adminUser: requester } = await testData.createOrganization();
    const { organizationProfile: targetProfile, organization: targetOrg } =
      await testData.createOrganization();

    // Add requester as a member of the target organization
    await testData.addUserToOrganization({
      authUserId: requester.authUserId,
      organizationId: targetOrg.id,
      email: requester.email,
    });

    // Create session as the requester
    const { session } = await createIsolatedSession(requester.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Should return an approved request instead of throwing
    const result = await caller.createJoinRequest({
      requestProfileId: requester.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(result.status).toBe('approved');

    // Verify a real join request record was persisted (not a phantom)
    const [dbRecord] = await db
      .select()
      .from(joinProfileRequests)
      .where(eq(joinProfileRequests.id, result.id));

    expect(dbRecord).toBeDefined();
    expect(dbRecord?.status).toBe(JoinProfileRequestStatus.APPROVED);
  });

  it('should auto-join with APPROVED status when email domain matches org domain', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create an org and set its domain to oneproject.org so the joiner can match
    const { organization, organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Domain Match Join Org',
      });

    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, organization.id));

    // Create a new user whose email domain matches the org
    const joinerEmail = `${task.id.slice(0, 8)}-domain-joiner@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    joinRequestData.trackAuthUser(authUser.id);

    // Get the joiner's individual profile ID
    const [joinerUser] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!joinerUser?.profileId) {
      throw new Error('Joiner user profile not found');
    }

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    joinRequestData.trackJoinRequest(result.id);

    // Should be auto-approved because domain matches
    expect(result.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Verify the user was added as an organization member
    const [orgUser] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organization.id),
          eq(organizationUsers.authUserId, authUser.id),
        ),
      );

    expect(orgUser).toBeDefined();

    // Verify the Member role was assigned
    const [memberRole] = await db
      .select({ roleName: accessRoles.name })
      .from(accessRoles)
      .where(eq(accessRoles.name, 'Member'));

    if (!memberRole) {
      throw new Error('Member role not found');
    }

    const [roleAssignment] = await db
      .select({ roleName: accessRoles.name })
      .from(organizationUserToAccessRoles)
      .innerJoin(
        accessRoles,
        eq(organizationUserToAccessRoles.accessRoleId, accessRoles.id),
      )
      .where(
        eq(organizationUserToAccessRoles.organizationUserId, orgUser?.id ?? ''),
      );

    expect(roleAssignment?.roleName).toBe('Member');
  });

  it('should create a PENDING request when email domain does not match org domain', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create an org with a specific non-matching domain
    const { organization, organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Non-Match Domain Org',
      });

    const restrictedDomain = `restricted-${task.id.slice(0, 8)}.com`;
    await db
      .update(organizations)
      .set({ domain: restrictedDomain })
      .where(eq(organizations.id, organization.id));

    // Create a joiner with oneproject.org (passes withAuthenticated but does NOT match org domain)
    const joinerEmail = `${task.id.slice(0, 8)}-nomatch-joiner@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    joinRequestData.trackAuthUser(authUser.id);

    const [joinerUser] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!joinerUser?.profileId) {
      throw new Error('Joiner user profile not found');
    }

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    joinRequestData.trackJoinRequest(result.id);

    // Should be PENDING because domain does not match
    expect(result.status).toBe(JoinProfileRequestStatus.PENDING);

    // Verify the user was NOT added as an organization member
    const orgUsers = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organization.id),
          eq(organizationUsers.authUserId, authUser.id),
        ),
      );

    expect(orgUsers).toHaveLength(0);
  });

  it('should return APPROVED for an already-a-member user without erroring', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create an org with domain match so the joiner auto-joins first
    const { organization, organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Already Member Org',
      });

    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, organization.id));

    // Create a joiner user with matching domain
    const joinerEmail = `${task.id.slice(0, 8)}-already-member@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    joinRequestData.trackAuthUser(authUser.id);

    const [joinerUser] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!joinerUser?.profileId) {
      throw new Error('Joiner user profile not found');
    }

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    // First call: auto-joins because domain matches
    const firstResult = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    joinRequestData.trackJoinRequest(firstResult.id);
    expect(firstResult.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Second call: user is now already a member - should succeed gracefully
    const secondResult = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    // Should still be APPROVED and not throw
    expect(secondResult.status).toBe(JoinProfileRequestStatus.APPROVED);
    expect(secondResult.requestProfileId).toBe(joinerUser.profileId);
    expect(secondResult.targetProfileId).toBe(targetProfile.id);
  });

  it('should auto-approve a previously rejected request when domain matches', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { organization, organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Rejected Then Domain Match Org',
      });

    // Create joiner with matching domain
    const joinerEmail = `${task.id.slice(0, 8)}-rejected-dm@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    joinRequestData.trackAuthUser(authUser.id);

    const [joinerUser] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!joinerUser?.profileId) {
      throw new Error('Joiner user profile not found');
    }

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    // First request — no domain set yet so it's PENDING
    const first = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    joinRequestData.trackJoinRequest(first.id);
    expect(first.status).toBe(JoinProfileRequestStatus.PENDING);

    // Admin rejects it
    await db
      .update(joinProfileRequests)
      .set({ status: JoinProfileRequestStatus.REJECTED })
      .where(eq(joinProfileRequests.id, first.id));

    // Now the org sets a matching domain
    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, organization.id));

    // Re-submit — should auto-approve and auto-join
    const second = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Verify the user was added as an organization member
    const [orgUser] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organization.id),
          eq(organizationUsers.authUserId, authUser.id),
        ),
      );

    expect(orgUser).toBeDefined();
  });

  it('should auto-approve a pending request when domain matches on re-submit', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { organization, organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Pending Then Domain Match Org',
      });

    // Create joiner with matching domain
    const joinerEmail = `${task.id.slice(0, 8)}-pending-dm@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    joinRequestData.trackAuthUser(authUser.id);

    const [joinerUser] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!joinerUser?.profileId) {
      throw new Error('Joiner user profile not found');
    }

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    // First request — no domain set yet so it's PENDING
    const first = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    joinRequestData.trackJoinRequest(first.id);
    expect(first.status).toBe(JoinProfileRequestStatus.PENDING);

    // Now the org sets a matching domain
    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, organization.id));

    // Re-submit — should auto-approve the existing pending request
    const second = await caller.createJoinRequest({
      requestProfileId: joinerUser.profileId,
      targetProfileId: targetProfile.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Verify the user was added as an organization member
    const [orgUser] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organization.id),
          eq(organizationUsers.authUserId, authUser.id),
        ),
      );

    expect(orgUser).toBeDefined();
  });

  it('should handle multiple join requests in parallel for domain-matched and non-matched orgs', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create two orgs: one with matching domain, one without
    const { organization: matchedOrg, organizationProfile: matchedProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Parallel Matched Org',
      });

    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, matchedOrg.id));

    const {
      organization: unmatchedOrg,
      organizationProfile: unmatchedProfile,
    } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Parallel Unmatched Org',
    });

    const unmatchedDomain = `unmatched-${task.id.slice(0, 8)}.com`;
    await db
      .update(organizations)
      .set({ domain: unmatchedDomain })
      .where(eq(organizations.id, unmatchedOrg.id));

    // Create a joiner user with oneproject.org domain
    const joinerEmail = `${task.id.slice(0, 8)}-parallel-join@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    joinRequestData.trackAuthUser(authUser.id);

    const [joinerUser] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!joinerUser?.profileId) {
      throw new Error('Joiner user profile not found');
    }

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    // Send both requests in parallel
    const [matchedResult, unmatchedResult] = await Promise.all([
      caller.createJoinRequest({
        requestProfileId: joinerUser.profileId,
        targetProfileId: matchedProfile.id,
      }),
      caller.createJoinRequest({
        requestProfileId: joinerUser.profileId,
        targetProfileId: unmatchedProfile.id,
      }),
    ]);

    joinRequestData.trackJoinRequest(matchedResult.id);
    joinRequestData.trackJoinRequest(unmatchedResult.id);

    // Domain-matched org should be auto-approved
    expect(matchedResult.status).toBe(JoinProfileRequestStatus.APPROVED);

    // Non-domain-matched org should be pending
    expect(unmatchedResult.status).toBe(JoinProfileRequestStatus.PENDING);

    // Verify matched org has the user as a member
    const [matchedOrgUser] = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, matchedOrg.id),
          eq(organizationUsers.authUserId, authUser.id),
        ),
      );

    expect(matchedOrgUser).toBeDefined();

    // Verify unmatched org does NOT have the user as a member
    const unmatchedOrgUsers = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, unmatchedOrg.id),
          eq(organizationUsers.authUserId, authUser.id),
        ),
      );

    expect(unmatchedOrgUsers).toHaveLength(0);
  });
});

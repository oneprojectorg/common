import { db } from '@op/db/client';
import {
  allowList,
  joinProfileRequests,
  locations,
  organizations,
  organizationsWhereWeWork,
  profiles,
  users,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../test/helpers/TestJoinProfileRequestDataManager';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { organizationRouter } from '../organization';
import { createJoinRequestRouter } from '../profile/requests/createJoinRequest';
import { deleteJoinRequestRouter } from '../profile/requests/deleteJoinRequest';
import { completeOnboarding } from './completeOnboarding';
import { getMyAccount } from './getMyAccount';
import { matchingDomainOrganizations } from './matchingDomainOrganizations';

describe.concurrent('Onboarding Organization Search', () => {
  const createAccountCaller = createCallerFactory(matchingDomainOrganizations);
  const createOrgCaller = createCallerFactory(organizationRouter);
  const createJoinRequestCaller = createCallerFactory(createJoinRequestRouter);
  const createDeleteJoinRequestCaller = createCallerFactory(
    deleteJoinRequestRouter,
  );
  const createCompleteCaller = createCallerFactory(completeOnboarding);
  const createAccountCaller2 = createCallerFactory(getMyAccount);

  /**
   * Helper to clean up a user created with createTestUser.
   * Deletes the individual profile (cascades) then the auth user.
   */
  const cleanupUser = async (authUserId: string) => {
    const [userRecord] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUserId));

    if (userRecord?.profileId) {
      await db.delete(profiles).where(eq(profiles.id, userRecord.profileId));
    }

    await supabaseTestAdminClient?.auth.admin.deleteUser(authUserId);
  };

  describe.concurrent(
    'US-009: individual user without org can skip to app',
    () => {
      it('returns empty list when user has no domain-matched organizations', async ({
        task,
        onTestFinished,
      }) => {
        // Use a unique domain that won't match any org, and add to allowList
        // to bypass the withAuthenticated middleware check.
        const uniqueDomain = `no-match-${task.id.slice(0, 8)}.test`;
        const email = `user@${uniqueDomain}`;
        const { user: authUser } = await createTestUser(email);

        // Add user to allowList so withAuthenticated lets them through
        const [allowListEntry] = await db
          .insert(allowList)
          .values({ email })
          .returning();
        onTestFinished(async () => {
          if (allowListEntry) {
            await db
              .delete(allowList)
              .where(eq(allowList.id, allowListEntry.id));
          }
        });

        if (!authUser) {
          throw new Error('Failed to create auth user');
        }

        onTestFinished(() => cleanupUser(authUser.id));

        const { session } = await createIsolatedSession(email);
        const caller = createAccountCaller(
          await createTestContextWithSession(session),
        );

        const result = await caller.listMatchingDomainOrganizations(undefined);

        expect(result).toEqual([]);
      });

      it('creates no join requests when user skips org selection', async ({
        task,
        onTestFinished,
      }) => {
        // Use oneproject.org to bypass allowList check in withAuthenticated middleware.
        const email = `${task.id.slice(0, 8)}-skip@oneproject.org`;
        const { user: authUser } = await createTestUser(email);

        if (!authUser) {
          throw new Error('Failed to create auth user');
        }

        onTestFinished(() => cleanupUser(authUser.id));

        const { session } = await createIsolatedSession(email);
        const caller = createAccountCaller(
          await createTestContextWithSession(session),
        );

        // User can call listMatchingDomainOrganizations (procedure works)
        const matchingOrgs =
          await caller.listMatchingDomainOrganizations(undefined);
        expect(Array.isArray(matchingOrgs)).toBe(true);

        // User "skips" — no createJoinRequest calls are made
        // Verify no join requests exist for this user
        const [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.authUserId, authUser.id));

        if (userRecord?.profileId) {
          const joinRequests = await db
            .select()
            .from(joinProfileRequests)
            .where(
              eq(joinProfileRequests.requestProfileId, userRecord.profileId),
            );

          expect(joinRequests).toHaveLength(0);
        }
        // If no profileId, user has no profile yet — trivially no join requests
      });
    },
  );

  describe.concurrent(
    'US-010: individual user can search, select orgs, and submit join requests',
    () => {
      it('returns matching organizations from search', async ({
        task,
        onTestFinished,
      }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );

        // Create a searchable organization
        const { organization, adminUser } = await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'SearchTestOrg',
        });

        // Search as the admin user (any authenticated user can search)
        const { session } = await createIsolatedSession(adminUser.email);
        const caller = createOrgCaller(
          await createTestContextWithSession(session),
        );

        // The org name includes the testId suffix from createOrganization
        const result = await caller.search({
          q: 'SearchTestOrg',
          limit: 10,
        });

        expect(Array.isArray(result)).toBe(true);

        // Verify our org appears in results
        const found = result.find((org) => org.id === organization.id);
        expect(found).toBeDefined();
      });

      it('creates join requests for selected organizations', async ({
        task,
        onTestFinished,
      }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );
        const joinRequestData = new TestJoinProfileRequestDataManager(
          task.id,
          onTestFinished,
        );

        // Create 2 target organizations
        const [org1, org2] = await Promise.all([
          testData.createOrganization({
            users: { admin: 1 },
            organizationName: 'JoinTarget1',
          }),
          testData.createOrganization({
            users: { admin: 1 },
            organizationName: 'JoinTarget2',
          }),
        ]);

        // Create a requester user (from a different org so they have a profile)
        const { adminUser: requester } = await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'RequesterOrg',
        });

        const { session } = await createIsolatedSession(requester.email);
        const caller = createJoinRequestCaller(
          await createTestContextWithSession(session),
        );

        // Submit join requests for both orgs (simulating "Continue with 2 organizations")
        const [result1, result2] = await Promise.all([
          caller.createJoinRequest({
            requestProfileId: requester.profileId,
            targetProfileId: org1.organizationProfile.id,
          }),
          caller.createJoinRequest({
            requestProfileId: requester.profileId,
            targetProfileId: org2.organizationProfile.id,
          }),
        ]);

        // Track for cleanup
        joinRequestData.trackJoinRequest(result1.id);
        joinRequestData.trackJoinRequest(result2.id);

        // Verify both requests were created with pending status
        expect(result1.status).toBe('pending');
        expect(result2.status).toBe('pending');
        expect(result1.requestProfileId).toBe(requester.profileId);
        expect(result2.requestProfileId).toBe(requester.profileId);
        expect(result1.targetProfileId).toBe(org1.organizationProfile.id);
        expect(result2.targetProfileId).toBe(org2.organizationProfile.id);

        // Verify join requests exist in the database
        const joinRequests = await db
          .select()
          .from(joinProfileRequests)
          .where(eq(joinProfileRequests.requestProfileId, requester.profileId));

        expect(joinRequests).toHaveLength(2);

        const targetProfileIds = joinRequests
          .map((r) => r.targetProfileId)
          .sort();
        const expectedProfileIds = [
          org1.organizationProfile.id,
          org2.organizationProfile.id,
        ].sort();
        expect(targetProfileIds).toEqual(expectedProfileIds);
      });
    },
  );

  describe.concurrent(
    'US-011: user with domain-matched org sees pre-selected org and can auto-join',
    () => {
      it('returns domain-matched organizations for user with matching email', async ({
        task,
        onTestFinished,
      }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );

        // Create an organization and set its domain to oneproject.org
        // oneproject.org emails bypass the allowList check in withAuthenticated
        const { organization } = await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'DomainMatchOrg',
        });

        await db
          .update(organizations)
          .set({ domain: 'oneproject.org' })
          .where(eq(organizations.id, organization.id));

        // Create a user whose email domain matches the org's domain
        const joinerEmail = `${task.id.slice(0, 8)}-domain-joiner@oneproject.org`;
        const { user: authUser } = await createTestUser(joinerEmail);

        if (!authUser) {
          throw new Error('Failed to create auth user');
        }

        onTestFinished(() => cleanupUser(authUser.id));

        const { session } = await createIsolatedSession(joinerEmail);
        const caller = createAccountCaller(
          await createTestContextWithSession(session),
        );

        const result = await caller.listMatchingDomainOrganizations(undefined);

        // Verify the domain-matched org is returned
        expect(result.length).toBeGreaterThanOrEqual(1);

        const matchedOrg = result.find((org) => org.id === organization.id);
        expect(matchedOrg).toBeDefined();
      });

      it('allows domain-matched user to auto-join via organization.join', async ({
        task,
        onTestFinished,
      }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );

        // Use oneproject.org domain since it bypasses allowList check
        const { organization } = await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'AutoJoinOrg',
        });

        await db
          .update(organizations)
          .set({ domain: 'oneproject.org' })
          .where(eq(organizations.id, organization.id));

        const joinerEmail = `${task.id.slice(0, 8)}-auto-joiner@oneproject.org`;
        const { user: authUser } = await createTestUser(joinerEmail);

        if (!authUser) {
          throw new Error('Failed to create auth user');
        }

        onTestFinished(() => cleanupUser(authUser.id));

        const { session } = await createIsolatedSession(joinerEmail);

        // Verify domain match returns the org
        const accountCaller = createAccountCaller(
          await createTestContextWithSession(session),
        );
        const matchingOrgs =
          await accountCaller.listMatchingDomainOrganizations(undefined);

        const matchedOrg = matchingOrgs.find(
          (org) => org.id === organization.id,
        );
        expect(matchedOrg).toBeDefined();

        // Auto-join the domain-matched org (this is what happens for domain-matched orgs)
        const orgCaller = createOrgCaller(
          await createTestContextWithSession(session),
        );
        const joinResult = await orgCaller.join({
          organizationId: organization.id,
        });

        expect(joinResult.organizationUserId).toBeTruthy();

        // Verify no join profile requests were created (domain match = direct join)
        const [userRecord] = await db
          .select()
          .from(users)
          .where(eq(users.authUserId, authUser.id));

        if (userRecord?.profileId) {
          const joinRequests = await db
            .select()
            .from(joinProfileRequests)
            .where(
              eq(joinProfileRequests.requestProfileId, userRecord.profileId),
            );

          expect(joinRequests).toHaveLength(0);
        }
      });

      it('returns whereWeWork location data for domain-matched organizations', async ({
        task,
        onTestFinished,
      }) => {
        const testData = new TestOrganizationDataManager(
          task.id,
          onTestFinished,
        );

        const { organization } = await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'LocationDataOrg',
        });

        await db
          .update(organizations)
          .set({ domain: 'oneproject.org' })
          .where(eq(organizations.id, organization.id));

        // Add a whereWeWork location for this org
        const [location] = await db
          .insert(locations)
          .values({
            name: 'Test City',
            placeId: `test-place-${task.id.slice(0, 8)}`,
            metadata: {},
          })
          .returning();

        if (!location) {
          throw new Error('Failed to create test location');
        }

        await db.insert(organizationsWhereWeWork).values({
          organizationId: organization.id,
          locationId: location.id,
        });

        onTestFinished(async () => {
          await db
            .delete(organizationsWhereWeWork)
            .where(
              eq(organizationsWhereWeWork.organizationId, organization.id),
            );
          await db.delete(locations).where(eq(locations.id, location.id));
        });

        const joinerEmail = `${task.id.slice(0, 8)}-loc-joiner@oneproject.org`;
        const { user: authUser } = await createTestUser(joinerEmail);

        if (!authUser) {
          throw new Error('Failed to create auth user');
        }

        onTestFinished(() => cleanupUser(authUser.id));

        const { session } = await createIsolatedSession(joinerEmail);
        const caller = createAccountCaller(
          await createTestContextWithSession(session),
        );

        const result = await caller.listMatchingDomainOrganizations(undefined);
        const matchedOrg = result.find((org) => org.id === organization.id);

        expect(matchedOrg).toBeDefined();
        expect(matchedOrg!.whereWeWork).toBeDefined();
        expect(matchedOrg!.whereWeWork.length).toBeGreaterThanOrEqual(1);

        const locationNames = matchedOrg!.whereWeWork.map(
          (loc: { name?: string | null }) => loc.name,
        );
        expect(locationNames).toContain('Test City');
      });
    },
  );

  describe.concurrent('UI interaction coverage', () => {
    it('removing all selected orgs re-enables skip (parallel join request then delete)', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const joinRequestData = new TestJoinProfileRequestDataManager(
        task.id,
        onTestFinished,
      );

      // Create a target org and a requester
      const { organizationProfile: targetProfile } =
        await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'RemoveChipOrg',
        });

      const { adminUser: requester } = await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'RequesterOrg',
      });

      const { session } = await createIsolatedSession(requester.email);
      const caller = createJoinRequestCaller(
        await createTestContextWithSession(session),
      );

      // Create a join request (simulates selecting an org)
      const result = await caller.createJoinRequest({
        requestProfileId: requester.profileId,
        targetProfileId: targetProfile.id,
      });

      joinRequestData.trackJoinRequest(result.id);
      expect(result.status).toBe('pending');

      // Verify the request exists in the DB
      const [existing] = await db
        .select()
        .from(joinProfileRequests)
        .where(eq(joinProfileRequests.id, result.id));

      expect(existing).toBeDefined();

      // Delete the join request (simulates removing the chip)
      const deleteCaller = createDeleteJoinRequestCaller(
        await createTestContextWithSession(session),
      );
      await deleteCaller.deleteJoinRequest({ requestId: result.id });

      // Verify it's deleted
      const [deleted] = await db
        .select()
        .from(joinProfileRequests)
        .where(eq(joinProfileRequests.id, result.id));

      expect(deleted).toBeUndefined();
    });
  });

  describe.concurrent(
    'Onboarding completion: user who skips org selection can access the app',
    () => {
      it('sets onboardedAt when completeOnboarding is called, preventing redirect loop', async ({
        task,
        onTestFinished,
      }) => {
        const joinerEmail = `${task.id.slice(0, 8)}-skip-loop@oneproject.org`;
        const { user: authUser } = await createTestUser(joinerEmail);

        if (!authUser) {
          throw new Error('Failed to create auth user');
        }

        onTestFinished(() => cleanupUser(authUser.id));

        const { session } = await createIsolatedSession(joinerEmail);

        // Before onboarding: user has no onboardedAt and no org memberships
        const accountCaller = createAccountCaller2(
          await createTestContextWithSession(session),
        );
        const userBefore = await accountCaller.getMyAccount();

        expect(userBefore.onboardedAt).toBeNull();
        expect(userBefore.organizationUsers).toHaveLength(0);

        // Complete onboarding (simulates clicking "Join Common" after skipping org selection)
        const completeCaller = createCompleteCaller(
          await createTestContextWithSession(session),
        );
        await completeCaller.completeOnboarding();

        // After onboarding: onboardedAt is set, tos and privacy are true
        const userAfter = await accountCaller.getMyAccount();

        expect(userAfter.onboardedAt).toBeTruthy();
        expect(userAfter.tos).toBe(true);
        expect(userAfter.privacy).toBe(true);

        // User still has no org memberships — but onboardedAt prevents the redirect loop
        expect(userAfter.organizationUsers).toHaveLength(0);
      });
    },
  );
});

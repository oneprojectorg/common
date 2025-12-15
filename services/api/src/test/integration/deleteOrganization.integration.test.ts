import { createOrganization } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  decisionProcesses,
  organizations,
  processInstances,
  profiles,
} from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { appRouter } from '../../routers';
import { createCallerFactory } from '../../trpcFactory';
import {
  cleanupTestData,
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  signOutTestUser,
} from '../supabase-utils';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.skip('Delete Organization Integration Tests', () => {
  let adminEmail: string;
  let memberEmail: string;
  let nonMemberEmail: string;
  let organizationId: string;
  let profileId: string;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'decision_process_instances',
      'decision_processes',
      'organization_user_to_access_roles',
      'organization_users',
      'organizations_terms',
      'organizations_strategies',
      'organizations_where_we_work',
      'organizations',
      'profiles',
      'links',
      'locations',
      'access_roles',
    ]);
    await signOutTestUser();

    // Create admin user
    adminEmail = `admin-${Date.now()}@example.com`;
    await createTestUser(adminEmail);
    const { session: adminSession } = await createIsolatedSession(adminEmail);

    // Create a test organization
    const organizationData = {
      name: 'Test Org To Delete',
      website: 'https://test-delete.org',
      email: 'contact@test-delete.org',
      orgType: 'nonprofit',
      bio: 'A test organization for deletion tests',
      mission: 'To test deletion functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const organization = await createOrganization({
      data: organizationData,
      user: adminSession.user,
    });

    organizationId = organization.id;
    profileId = organization.profile.id;

    // Create member user (will be added to org without admin role)
    memberEmail = `member-${Date.now()}@example.com`;
    await createTestUser(memberEmail);

    // Create non-member user
    nonMemberEmail = `non-member-${Date.now()}@example.com`;
    await createTestUser(nonMemberEmail);
  });

  describe('deleteOrganization', () => {
    it('should successfully delete organization when user is admin', async () => {
      const caller = await createAuthenticatedCaller(adminEmail);

      const result = await caller.organization.deleteOrganization({
        organizationId,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(organizationId);
      expect(result.deletedProfileId).toBe(profileId);

      // Verify organization was actually deleted
      const deletedOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });
      expect(deletedOrg).toBeUndefined();

      // Verify profile was also deleted (cascade)
      const deletedProfile = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
      });
      expect(deletedProfile).toBeUndefined();
    });

    it('should throw unauthorized error when user is not a member', async () => {
      const caller = await createAuthenticatedCaller(nonMemberEmail);

      await expect(
        caller.organization.deleteOrganization({
          organizationId,
        }),
      ).rejects.toThrow();
    });

    it('should throw not found error for non-existent organization', async () => {
      const caller = await createAuthenticatedCaller(adminEmail);

      await expect(
        caller.organization.deleteOrganization({
          organizationId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow();
    });

    it('should throw validation error when organization has active decision processes', async () => {
      // First create a decision process schema
      const [process] = await db
        .insert(decisionProcesses)
        .values({
          name: 'Test Process',
          description: 'Test process description',
          processSchema: {},
          createdByProfileId: profileId,
        })
        .returning();

      if (!process) {
        throw new Error('Failed to create process');
      }

      // Create an active (draft) process instance for this organization
      await db.insert(processInstances).values({
        name: 'Test Instance',
        processId: process.id,
        ownerProfileId: profileId,
        status: 'draft',
        instanceData: {},
      });

      const caller = await createAuthenticatedCaller(adminEmail);

      await expect(
        caller.organization.deleteOrganization({
          organizationId,
        }),
      ).rejects.toThrow(/active decision processes/i);

      // Verify organization was NOT deleted
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });
      expect(org).toBeDefined();
    });

    it('should allow deletion when all decision processes are completed', async () => {
      // First create a decision process schema
      const [process] = await db
        .insert(decisionProcesses)
        .values({
          name: 'Test Process',
          description: 'Test process description',
          processSchema: {},
          createdByProfileId: profileId,
        })
        .returning();

      if (!process) {
        throw new Error('Failed to create process');
      }

      // Create a completed process instance
      await db.insert(processInstances).values({
        name: 'Completed Instance',
        processId: process.id,
        ownerProfileId: profileId,
        status: 'completed',
        instanceData: {},
      });

      const caller = await createAuthenticatedCaller(adminEmail);

      const result = await caller.organization.deleteOrganization({
        organizationId,
      });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(organizationId);
    });

    it('should allow deletion when all decision processes are cancelled', async () => {
      // First create a decision process schema
      const [process] = await db
        .insert(decisionProcesses)
        .values({
          name: 'Test Process',
          description: 'Test process description',
          processSchema: {},
          createdByProfileId: profileId,
        })
        .returning();

      if (!process) {
        throw new Error('Failed to create process');
      }

      // Create a cancelled process instance
      await db.insert(processInstances).values({
        name: 'Cancelled Instance',
        processId: process.id,
        ownerProfileId: profileId,
        status: 'cancelled',
        instanceData: {},
      });

      const caller = await createAuthenticatedCaller(adminEmail);

      const result = await caller.organization.deleteOrganization({
        organizationId,
      });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(organizationId);
    });

    it('should cascade delete organization users', async () => {
      // Verify org users exist before deletion
      const orgUsersBefore = await db.query.organizationUsers.findMany({
        where: (table, { eq }) => eq(table.organizationId, organizationId),
      });
      expect(orgUsersBefore.length).toBeGreaterThan(0);

      const caller = await createAuthenticatedCaller(adminEmail);

      await caller.organization.deleteOrganization({
        organizationId,
      });

      // Verify org users were deleted via cascade
      const orgUsersAfter = await db.query.organizationUsers.findMany({
        where: (table, { eq }) => eq(table.organizationId, organizationId),
      });
      expect(orgUsersAfter.length).toBe(0);
    });

    it('should not allow deleting organization twice', async () => {
      const caller = await createAuthenticatedCaller(adminEmail);

      // First deletion should succeed
      await caller.organization.deleteOrganization({
        organizationId,
      });

      // Second deletion should fail
      await expect(
        caller.organization.deleteOrganization({
          organizationId,
        }),
      ).rejects.toThrow();
    });
  });
});

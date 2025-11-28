import { getRoles, joinOrganization } from '@op/common';
import { db } from '@op/db/client';
import { allowList, organizations } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';
import { TestUserDataManager } from '../helpers/TestUserDataManager';

describe.concurrent('Role ID System Integration Tests', () => {
  describe.concurrent('getRoles functionality', () => {
    it('should return all available roles with IDs', async ({
      task,
      onTestFinished,
    }) => {
      // We don't need test data for this test, but we maintain the pattern
      new TestOrganizationDataManager(task.id, onTestFinished);

      const result = await getRoles();

      expect(result.roles).toBeDefined();
      expect(result.roles.length).toBeGreaterThanOrEqual(2);

      // Verify structure
      result.roles.forEach((role) => {
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(typeof role.id).toBe('string');
        expect(typeof role.name).toBe('string');
      });

      // Verify specific roles exist
      const roleNames = result.roles.map((r) => r.name);
      expect(roleNames).toContain('Admin');
      expect(roleNames).toContain('Member');
    });

    it('should return roles sorted by name', async ({
      task,
      onTestFinished,
    }) => {
      new TestOrganizationDataManager(task.id, onTestFinished);

      const result = await getRoles();

      const roleNames = result.roles.map((r) => r.name);
      const sortedNames = [...roleNames].sort();

      expect(roleNames).toEqual(sortedNames);
    });
  });

  describe.concurrent('Role assignment with IDs', () => {
    it('should assign role by ID during organization join via allowList', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const userManager = new TestUserDataManager(task.id, onTestFinished);

      // Create an organization
      const { organization } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      // Create a new user that will join via allowList using TestUserDataManager
      const joiningUserEmail = `joining-user@different-domain.com`;
      const { authUserId, userRecord } =
        await userManager.createUser(joiningUserEmail);

      // Add user to allowList with Member role
      const [allowListEntry] = await db
        .insert(allowList)
        .values({
          email: userRecord.email,
          organizationId: organization.id,
          metadata: {
            roleId: ROLES.MEMBER.id,
            inviteType: 'existing_organization',
            invitedBy: authUserId,
            invitedAt: new Date().toISOString(),
          },
        })
        .returning();

      // Track allowList entry for cleanup
      if (allowListEntry) {
        userManager.trackAllowListEntry(allowListEntry.id);
      }

      // Get full organization record for joinOrganization
      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      // User joins organization
      const result = await joinOrganization({
        user: userRecord,
        organization: fullOrg,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      // Verify user got Member role (from allowList)
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, authUserId),
            eq(table.organizationId, organization.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Member');
    });

    it('should use roleId parameter when provided directly', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const userManager = new TestUserDataManager(task.id, onTestFinished);

      // Create an organization
      const { organization } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      // Create a new user using TestUserDataManager
      const joiningUserEmail = `direct-role@different-domain.com`;
      const { authUserId, userRecord } =
        await userManager.createUser(joiningUserEmail);

      // Get full organization record
      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      // User joins organization with explicit roleId (bypasses allowList check)
      const result = await joinOrganization({
        user: userRecord,
        organization: fullOrg,
        roleId: ROLES.ADMIN.id,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      // Verify user got Admin role (from roleId parameter)
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, authUserId),
            eq(table.organizationId, organization.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Admin');
    });

    it('should fallback to Member role when roleId is invalid', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const userManager = new TestUserDataManager(task.id, onTestFinished);

      // Create an organization
      const { organization } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      // Create a new user using TestUserDataManager
      const joiningUserEmail = `fallback@different-domain.com`;
      const { authUserId, userRecord } =
        await userManager.createUser(joiningUserEmail);

      // Add user to allowList with invalid roleId
      const [allowListEntry] = await db
        .insert(allowList)
        .values({
          email: userRecord.email,
          organizationId: organization.id,
          metadata: {
            roleId: '00000000-0000-0000-0000-000000000000', // Invalid ID
            inviteType: 'existing_organization',
            invitedBy: authUserId,
            invitedAt: new Date().toISOString(),
          },
        })
        .returning();

      // Track allowList entry for cleanup
      if (allowListEntry) {
        userManager.trackAllowListEntry(allowListEntry.id);
      }

      // Get full organization record
      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      // User joins organization
      const result = await joinOrganization({
        user: userRecord,
        organization: fullOrg,
      });

      expect(result).toBeDefined();

      // Verify user got Member role as fallback
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, authUserId),
            eq(table.organizationId, organization.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles[0]?.accessRole.name).toBe('Member');
    });
  });

  describe.concurrent('Existing membership handling', () => {
    it('should return existing membership if user is already a member', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create an organization with an admin user (who is already a member)
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'example.com',
      });

      // Get the user record from the admin user created by TestOrganizationDataManager
      const userRecord = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, adminUser.authUserId),
      });

      if (!userRecord) {
        throw new Error('User record not found');
      }

      // Get full organization record
      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      // Try to join the organization again
      const result = await joinOrganization({
        user: userRecord,
        organization: fullOrg,
        roleId: ROLES.MEMBER.id, // Try with a different role
      });

      // Should return the existing membership
      expect(result).toBeDefined();
      expect(result.id).toBe(adminUser.organizationUserId);

      // Verify the role was not changed (still Admin)
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, adminUser.organizationUserId),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles[0]?.accessRole.name).toBe('Admin');
    });
  });

  describe.concurrent('Domain-based access', () => {
    it('should reject join when email domain does not match and not on allowList', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const userManager = new TestUserDataManager(task.id, onTestFinished);

      // Create an organization with a specific domain
      const { organization } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'company.com',
      });

      // Update the organization to have a domain
      await db
        .update(organizations)
        .set({ domain: 'company.com' })
        .where(eq(organizations.id, organization.id));

      // Create a user with a different domain using TestUserDataManager
      const outsiderEmail = `outsider@different-domain.com`;
      const { userRecord } = await userManager.createUser(outsiderEmail);

      // Get full organization record
      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      // Attempt to join should fail
      await expect(
        joinOrganization({
          user: userRecord,
          organization: fullOrg,
        }),
      ).rejects.toThrow(
        'Your email does not have access to join this organization',
      );
    });
  });

  describe.concurrent('Data integrity', () => {
    it('should maintain referential integrity between roles and assignments', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create an organization with an admin and member
      const { organization, adminUser, memberUsers } =
        await testData.createOrganization({
          users: { admin: 1, member: 1 },
        });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Failed to create member user');
      }

      // Verify both users have proper role assignments
      const adminOrgUser = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, adminUser.organizationUserId),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      const memberOrgUser = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, memberUser.organizationUserId),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(adminOrgUser?.roles).toHaveLength(1);
      expect(adminOrgUser?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
      expect(adminOrgUser?.roles[0]?.accessRole.name).toBe('Admin');

      expect(memberOrgUser?.roles).toHaveLength(1);
      expect(memberOrgUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
      expect(memberOrgUser?.roles[0]?.accessRole.name).toBe('Member');

      // Verify both users belong to the same organization
      expect(adminOrgUser?.organizationId).toBe(organization.id);
      expect(memberOrgUser?.organizationId).toBe(organization.id);
    });
  });
});

import { createOrganization, inviteUsers } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  accessRoles,
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe.skip('Organization User Management Integration Tests', () => {
  let adminUser: any;
  let memberUser: any;
  let nonMemberUser: any;
  let organizationId: string;
  let profileId: string;
  let memberOrgUserId: string;
  let adminRole: any;
  let memberRole: any;
  let createCaller: ReturnType<typeof createCallerFactory>;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
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
    const adminEmail = `admin-${Date.now()}@example.com`;
    await createTestUser(adminEmail);
    await signInTestUser(adminEmail);
    const adminSession = await getCurrentTestSession();
    adminUser = adminSession?.user;

    // Create a test organization
    const organizationData = {
      name: 'Test User Management Org',
      website: 'https://test-mgmt.org',
      email: 'contact@test-mgmt.org',
      orgType: 'nonprofit',
      bio: 'A test organization for user management',
      mission: 'To test user management functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const organization = await createOrganization({
      data: organizationData,
      user: adminUser,
    });

    organizationId = organization.id;
    profileId = organization.profile.id;

    // Note: The createOrganization function should automatically create
    // the admin user with proper permissions via the access-zones system

    // Create member user and add to organization
    const memberEmail = `member-${Date.now()}@example.com`;
    await createTestUser(memberEmail);
    await signInTestUser(memberEmail);
    const memberSession = await getCurrentTestSession();
    memberUser = memberSession?.user;

    // Add member to organization
    const invitedUsers = await inviteUsers({
      profileId,
      emails: [memberEmail],
      user: adminUser,
    });

    // Get the organization user ID for the member
    const memberOrgUser = await db.query.organizationUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.authUserId, memberUser.id),
        ),
    });
    memberOrgUserId = memberOrgUser!.id;

    // Create non-member user
    const nonMemberEmail = `non-member-${Date.now()}@example.com`;
    await createTestUser(nonMemberEmail);
    await signInTestUser(nonMemberEmail);
    const nonMemberSession = await getCurrentTestSession();
    nonMemberUser = nonMemberSession?.user;

    // Create some access roles (separate from admin role already created)
    const roles = await db
      .insert(accessRoles)
      .values([
        {
          name: 'Editor',
          description: 'Editor role',
        },
        {
          name: 'Member',
          description: 'Basic member role',
        },
      ])
      .returning();

    adminRole = roles[0]; // Will use this as 'Editor' role for testing role assignments
    memberRole = roles[1];

    // Create tRPC caller
    createCaller = createCallerFactory(organizationRouter);

    // Sign back in as admin for tests
    await signInTestUser(adminEmail);
  });

  describe('updateOrganizationUser', () => {
    it('should successfully update user basic information', async () => {
      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        about: 'Updated bio information',
      };

      const result = await caller.updateOrganizationUser({
        organizationId,
        organizationUserId: memberOrgUserId,
        data: updateData,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe(updateData.name);
      expect(result.email).toBe(updateData.email);
      expect(result.about).toBe(updateData.about);
      expect(result.organizationId).toBe(organizationId);
    });

    it('should successfully update user roles', async () => {
      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.updateOrganizationUser({
        organizationId,
        organizationUserId: memberOrgUserId,
        data: {
          roleIds: [adminRole.id, memberRole.id],
        },
      });

      expect(result).toBeDefined();
      expect(result.roles).toBeDefined();
      expect(result.roles.length).toBe(2);

      const roleNames = result.roles.map((role) => role.name).sort();
      expect(roleNames).toEqual(['Editor', 'Member']);
    });

    it('should successfully remove all roles by providing empty array', async () => {
      // First add some roles
      await db.insert(organizationUserToAccessRoles).values([
        {
          organizationUserId: memberOrgUserId,
          accessRoleId: adminRole.id,
        },
      ]);

      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.updateOrganizationUser({
        organizationId,
        organizationUserId: memberOrgUserId,
        data: {
          roleIds: [], // Remove all roles
        },
      });

      expect(result).toBeDefined();
      expect(result.roles).toBeDefined();
      expect(result.roles.length).toBe(0);
    });

    it('should throw error for invalid role IDs', async () => {
      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.updateOrganizationUser({
          organizationId,
          organizationUserId: memberOrgUserId,
          data: {
            roleIds: ['00000000-0000-0000-0000-000000000000'],
          },
        });
      }).rejects.toThrow(/invalid/i);
    });

    it('should throw unauthorized error for members without admin role', async () => {
      // Switch to member user who doesn't have admin role
      await signInTestUser(`member-${Date.now()}@example.com`);

      const caller = createCaller({
        user: memberUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.updateOrganizationUser({
          organizationId,
          organizationUserId: memberOrgUserId,
          data: {
            name: 'New Name',
          },
        });
      }).rejects.toThrow(/permission/i);
    });

    it('should throw unauthorized error for non-members', async () => {
      const caller = createCaller({
        user: nonMemberUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.updateOrganizationUser({
          organizationId,
          organizationUserId: memberOrgUserId,
          data: {
            name: 'New Name',
          },
        });
      }).rejects.toThrow(/permission/i);
    });

    it('should throw error for non-existent organization user', async () => {
      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.updateOrganizationUser({
          organizationId,
          organizationUserId: '00000000-0000-0000-0000-000000000000',
          data: {
            name: 'New Name',
          },
        });
      }).rejects.toThrow(/not found/i);
    });
  });

  describe('deleteOrganizationUser', () => {
    it('should successfully delete organization user', async () => {
      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.deleteOrganizationUser({
        organizationId,
        organizationUserId: memberOrgUserId,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(memberOrgUserId);
      expect(result.organizationId).toBe(organizationId);

      // Verify user was actually deleted
      const deletedUser = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, memberOrgUserId),
      });
      expect(deletedUser).toBeUndefined();
    });

    it('should automatically remove role assignments when user is deleted', async () => {
      // First add a role to the user
      await db.insert(organizationUserToAccessRoles).values({
        organizationUserId: memberOrgUserId,
        accessRoleId: adminRole.id,
      });

      // Verify role assignment exists
      const roleAssignment =
        await db.query.organizationUserToAccessRoles.findFirst({
          where: (table, { eq }) =>
            eq(table.organizationUserId, memberOrgUserId),
        });
      expect(roleAssignment).toBeDefined();

      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      await caller.deleteOrganizationUser({
        organizationId,
        organizationUserId: memberOrgUserId,
      });

      // Verify role assignment was deleted via cascade
      const deletedRoleAssignment =
        await db.query.organizationUserToAccessRoles.findFirst({
          where: (table, { eq }) =>
            eq(table.organizationUserId, memberOrgUserId),
        });
      expect(deletedRoleAssignment).toBeUndefined();
    });

    it('should throw error when trying to delete self', async () => {
      // Get admin's organization user ID
      const adminOrgUser = await db.query.organizationUsers.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.organizationId, organizationId),
            eq(table.authUserId, adminUser.id),
          ),
      });

      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.deleteOrganizationUser({
          organizationId,
          organizationUserId: adminOrgUser!.id,
        });
      }).rejects.toThrow(/cannot remove yourself/i);
    });

    it('should throw unauthorized error for non-members', async () => {
      const caller = createCaller({
        user: nonMemberUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.deleteOrganizationUser({
          organizationId,
          organizationUserId: memberOrgUserId,
        });
      }).rejects.toThrow(/permission/i);
    });

    it('should throw error for non-existent organization user', async () => {
      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      await expect(async () => {
        await caller.deleteOrganizationUser({
          organizationId,
          organizationUserId: '00000000-0000-0000-0000-000000000000',
        });
      }).rejects.toThrow(/not found/i);
    });

    it('should throw error when trying to delete user from different organization', async () => {
      // Create another organization and user
      const otherOrgData = {
        name: 'Other Org',
        website: 'https://other.org',
        email: 'contact@other.org',
        orgType: 'nonprofit',
        bio: 'Another organization',
        mission: 'To test cross-org security',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      };

      const otherOrg = await createOrganization({
        data: otherOrgData,
        user: adminUser,
      });

      const caller = createCaller({
        user: adminUser,
        req: {} as any,
        res: {} as any,
      });

      // Try to delete member from wrong organization
      await expect(async () => {
        await caller.deleteOrganizationUser({
          organizationId: otherOrg.id,
          organizationUserId: memberOrgUserId, // This user belongs to the first org
        });
      }).rejects.toThrow(/not found/i);
    });
  });
});


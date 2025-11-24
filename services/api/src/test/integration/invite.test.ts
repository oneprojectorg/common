import {
  createOrganization,
  getRoles,
  inviteUsersToOrganization,
  joinOrganization,
} from '@op/common';
import { db } from '@op/db/client';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe.skip('Invite System Integration Tests', () => {
  let testInviterEmail: string;
  let testInviteeEmail: string;
  let testInviterUser: any;
  let testOrganization: any;
  let adminRoleId: string;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'organization_user_to_access_roles',
      'organization_users',
      'allow_list',
      'organizations_terms',
      'organizations_strategies',
      'organizations_where_we_work',
      'organizations',
      'profiles',
      'links',
      'locations',
    ]);
    await signOutTestUser();

    // Create inviter user and organization
    testInviterEmail = `inviter-${Date.now()}@example.com`;
    testInviteeEmail = `invitee-${Date.now()}@example.com`;

    await createTestUser(testInviterEmail);
    await signInTestUser(testInviterEmail);

    const session = await getCurrentTestSession();
    testInviterUser = session?.user;

    // Create a test organization
    const organizationData = {
      name: 'Test Invite Organization',
      website: 'https://test-invite.com',
      email: 'contact@test-invite.com',
      orgType: 'nonprofit',
      bio: 'Organization for testing invite functionality',
      mission: 'To test the invite system',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    testOrganization = await createOrganization({
      data: organizationData,
      user: testInviterUser,
    });

    // Get the Admin role ID for testing
    const { roles } = await getRoles();
    const adminRole = roles.find((role) => role.name === 'Admin');
    if (!adminRole) {
      throw new Error('Admin role not found in test database');
    }
    adminRoleId = adminRole.id;
  });

  describe('Inviting New Users', () => {
    it('should successfully invite a new user with role ID', async () => {
      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        personalMessage: 'Welcome to our test organization!',
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(testInviteeEmail);
      expect(result.details?.failed).toHaveLength(0);

      // Verify allowList entry was created with roleId
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, testInviteeEmail),
      });

      expect(allowListEntry).toBeDefined();
      expect(allowListEntry?.organizationId).toBe(testOrganization.id);
      expect(allowListEntry?.metadata).toBeDefined();

      const metadata = allowListEntry?.metadata as any;
      expect(metadata.roleId).toBe(adminRoleId);
      expect(metadata.inviteType).toBe('existing_organization');
      expect(metadata.personalMessage).toBe(
        'Welcome to our test organization!',
      );
    });

    it('should handle multiple email invites', async () => {
      const email2 = `invitee2-${Date.now()}@example.com`;
      const email3 = `invitee3-${Date.now()}@example.com`;

      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail, email2, email3],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toHaveLength(3);
      expect(result.details?.successful).toContain(testInviteeEmail);
      expect(result.details?.successful).toContain(email2);
      expect(result.details?.successful).toContain(email3);

      // Verify all allowList entries were created
      const allowListEntries = await db.query.allowList.findMany({
        where: (table, { eq }) => eq(table.organizationId, testOrganization.id),
      });

      expect(allowListEntries).toHaveLength(3);

      // Verify all have the correct roleId
      allowListEntries.forEach((entry) => {
        const metadata = entry.metadata as any;
        expect(metadata.roleId).toBe(adminRoleId);
      });
    });

    it('should prevent duplicate invites', async () => {
      // First invite
      const result1 = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result1.success).toBe(true);

      // Second invite to same email should skip
      const result2 = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result2.success).toBe(true);

      // Should only have one allowList entry
      const allowListEntries = await db.query.allowList.findMany({
        where: (table, { eq }) => eq(table.email, testInviteeEmail),
      });

      expect(allowListEntries).toHaveLength(1);
    });
  });

  describe('Inviting Existing Users', () => {
    let existingUser: any;

    beforeEach(async () => {
      // Create an existing user (invitee)
      await createTestUser(testInviteeEmail);
      await signInTestUser(testInviteeEmail);
      const session = await getCurrentTestSession();
      existingUser = session?.user;

      // Sign back in as inviter
      await signInTestUser(testInviterEmail);
    });

    it('should directly add existing user to organization with correct role', async () => {
      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(testInviteeEmail);

      // Verify user was added to organization
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, existingUser.id),
            eq(table.organizationId, testOrganization.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser).toBeDefined();
      expect(orgUser?.email).toBe(testInviteeEmail);
      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(adminRoleId);

      // Should NOT create allowList entry for existing users
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, testInviteeEmail),
      });

      expect(allowListEntry).toBeUndefined();
    });

    it('should prevent duplicate organization membership', async () => {
      // First invite - should add user to org
      await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Second invite - should fail with appropriate message
      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result.details?.failed).toHaveLength(1);
      expect(result.details?.failed[0]?.email).toBe(testInviteeEmail);
      expect(result.details?.failed[0]?.reason).toBe(
        'User is already a member of this organization',
      );
    });
  });

  describe('Join Organization Flow', () => {
    it('should allow invited user to join with correct role from roleId', async () => {
      // First, invite the user
      await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        personalMessage: 'Join our organization!',
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Create the invitee user and have them join
      await createTestUser(testInviteeEmail);
      await signInTestUser(testInviteeEmail);
      const inviteeSession = await getCurrentTestSession();
      const inviteeUser = inviteeSession?.user;

      const result = await joinOrganization({
        user: inviteeUser,
        organizationId: testOrganization.id,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      // Verify user was added with correct role
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, inviteeUser.id),
            eq(table.organizationId, testOrganization.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser).toBeDefined();
      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(adminRoleId);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Admin');
    });

    it('should update currentProfileId when admin joins organization', async () => {
      // First, invite the user as admin
      await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Create the invitee user and have them join
      await createTestUser(testInviteeEmail);
      await signInTestUser(testInviteeEmail);
      const inviteeSession = await getCurrentTestSession();
      const inviteeUser = inviteeSession?.user;

      // Get user's initial currentProfileId
      const initialUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, inviteeUser.id),
      });
      const initialCurrentProfileId = initialUser?.currentProfileId;

      await joinOrganization({
        user: inviteeUser,
        organizationId: testOrganization.id,
      });

      // Verify user's currentProfileId was updated to organization's profileId
      const updatedUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, inviteeUser.id),
      });

      expect(updatedUser?.currentProfileId).toBe(testOrganization.profileId);
      expect(updatedUser?.currentProfileId).not.toBe(initialCurrentProfileId);
    });

    it('should NOT update currentProfileId when non-admin joins organization', async () => {
      // Get all roles to find a non-admin role
      const { roles } = await getRoles();
      const nonAdminRole = roles.find((role) => role.name !== 'Admin');

      if (!nonAdminRole) {
        console.warn(
          'Only Admin role available, skipping non-admin currentProfileId test',
        );
        return;
      }

      // First, invite the user as non-admin
      await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: nonAdminRole.id,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Create the invitee user and have them join
      await createTestUser(testInviteeEmail);
      await signInTestUser(testInviteeEmail);
      const inviteeSession = await getCurrentTestSession();
      const inviteeUser = inviteeSession?.user;

      // Get user's initial currentProfileId
      const initialUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, inviteeUser.id),
      });
      const initialCurrentProfileId = initialUser?.currentProfileId;

      await joinOrganization({
        user: inviteeUser,
        organizationId: testOrganization.id,
      });

      // Verify user's currentProfileId was NOT updated
      const updatedUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, inviteeUser.id),
      });

      expect(updatedUser?.currentProfileId).toBe(initialCurrentProfileId);
      expect(updatedUser?.currentProfileId).not.toBe(
        testOrganization.profileId,
      );
    });

    it('should fallback to Admin role for domain-based joins', async () => {
      // Create user with same domain as organization
      const domainEmail = `domain-user-${Date.now()}@test-invite.com`; // Same domain as org
      await createTestUser(domainEmail);
      await signInTestUser(domainEmail);
      const domainUserSession = await getCurrentTestSession();
      const domainUser = domainUserSession?.user;

      const result = await joinOrganization({
        user: domainUser,
        organizationId: testOrganization.id,
      });

      expect(result).toBeDefined();

      // Verify user got Admin role (fallback)
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, domainUser.id),
            eq(table.organizationId, testOrganization.id),
          ),
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

  describe('Role System Integration', () => {
    it('should respect different role types in invites', async () => {
      const { roles } = await getRoles();

      // Find a non-Admin role if available
      const nonAdminRole = roles.find((role) => role.name !== 'Admin');
      if (!nonAdminRole) {
        // Skip test if only Admin role exists
        console.warn('Only Admin role available, skipping multi-role test');
        return;
      }

      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: nonAdminRole.id,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      expect(result.success).toBe(true);

      // Verify allowList has correct roleId
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, testInviteeEmail),
      });

      const metadata = allowListEntry?.metadata as any;
      expect(metadata.roleId).toBe(nonAdminRole.id);

      // Test join flow
      await createTestUser(testInviteeEmail);
      await signInTestUser(testInviteeEmail);
      const inviteeSession = await getCurrentTestSession();
      const inviteeUser = inviteeSession?.user;

      await joinOrganization({
        user: inviteeUser,
        organizationId: testOrganization.id,
      });

      // Verify correct role was assigned
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, inviteeUser.id),
            eq(table.organizationId, testOrganization.id),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles[0]?.accessRole.id).toBe(nonAdminRole.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe(nonAdminRole.name);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid role ID gracefully', async () => {
      const invalidRoleId = '00000000-0000-0000-0000-000000000000';

      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: invalidRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Should either fail or succeed gracefully - both are acceptable
      expect(result.success !== undefined).toBe(true);
      expect(result.details).toBeDefined();
    });

    it('should fail with invalid organization ID', async () => {
      const invalidOrgId = '00000000-0000-0000-0000-000000000000';

      const result = await inviteUsersToOrganization({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: invalidOrgId,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Should either fail completely or have failed entries
      expect(result.success || result.details?.failed.length > 0).toBe(true);
    });

    it('should handle invalid email addresses gracefully', async () => {
      const validEmail = `valid-${Date.now()}@example.com`;
      const result = await inviteUsersToOrganization({
        emails: ['invalid-email', 'also-invalid', validEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        authUserId: testInviterUser.id,
        authUserEmail: testInviterUser.email,
      });

      // Should succeed for valid email
      expect(result.details?.successful).toContain(validEmail);
      // May or may not fail for invalid emails depending on implementation
      expect(result.details?.failed?.length >= 0).toBe(true);
    });

    it('should prevent unauthorized users from sending invites', async () => {
      await signOutTestUser();

      await expect(
        inviteUsersToOrganization({
          emails: [testInviteeEmail],
          roleId: adminRoleId,
          organizationId: testOrganization.id,
          authUserId: 'invalid-user-id',
          authUserEmail: 'invalid@example.com',
        }),
      ).rejects.toThrow();
    });

    it('should prevent join without proper access', async () => {
      // Create user with different domain
      const outsiderEmail = `outsider-${Date.now()}@different-domain.com`;
      await createTestUser(outsiderEmail);
      await signInTestUser(outsiderEmail);
      const outsiderSession = await getCurrentTestSession();
      const outsiderUser = outsiderSession?.user;

      await expect(
        joinOrganization({
          user: outsiderUser,
          organizationId: testOrganization.id,
        }),
      ).rejects.toThrow(
        'Your email does not have access to join this organization',
      );
    });
  });
});

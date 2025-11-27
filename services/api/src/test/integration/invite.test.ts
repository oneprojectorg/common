import { inviteUsersToOrganization, joinOrganization } from '@op/common';
import { db } from '@op/db/client';
import { allowList, organizations, users } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../supabase-utils';

describe.concurrent('Invite System Integration Tests', () => {
  describe.concurrent('Inviting New Users', () => {
    it('should successfully invite a new user with role ID', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create an organization with an admin
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test-invite.com',
      });

      // Get a session for the admin user
      const { session } = await createIsolatedSession(adminUser.email);

      // Email to invite (doesn't exist yet)
      const inviteeEmail = `${task.id}-invitee@example.com`;

      const result = await inviteUsersToOrganization({
        emails: [inviteeEmail],
        roleId: ROLES.MEMBER.id,
        organizationId: organization.id,
        personalMessage: 'Welcome to our test organization!',
        user: session.user,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(inviteeEmail);
      expect(result.details?.failed).toHaveLength(0);

      // Verify allowList entry was created with roleId
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, inviteeEmail),
      });

      expect(allowListEntry).toBeDefined();
      expect(allowListEntry?.organizationId).toBe(organization.id);
      expect(allowListEntry?.metadata).toBeDefined();

      const metadata = allowListEntry?.metadata as any;
      expect(metadata.roleId).toBe(ROLES.MEMBER.id);
      expect(metadata.inviteType).toBe('existing_organization');
      expect(metadata.personalMessage).toBe(
        'Welcome to our test organization!',
      );

      // Cleanup allowList entry
      onTestFinished(async () => {
        if (allowListEntry) {
          await db.delete(allowList).where(eq(allowList.id, allowListEntry.id));
        }
      });
    });

    it('should handle multiple email invites', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test-invite.com',
      });

      const { session } = await createIsolatedSession(adminUser.email);

      const email1 = `${task.id}-invitee1@example.com`;
      const email2 = `${task.id}-invitee2@example.com`;
      const email3 = `${task.id}-invitee3@example.com`;

      const result = await inviteUsersToOrganization({
        emails: [email1, email2, email3],
        roleId: ROLES.MEMBER.id,
        organizationId: organization.id,
        user: session.user,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toHaveLength(3);
      expect(result.details?.successful).toContain(email1);
      expect(result.details?.successful).toContain(email2);
      expect(result.details?.successful).toContain(email3);

      // Verify all allowList entries were created
      const allowListEntries = await db.query.allowList.findMany({
        where: (table, { eq }) => eq(table.organizationId, organization.id),
      });

      // Should have at least 3 entries (could be more if other tests ran)
      const invitedEmails = [email1, email2, email3];
      const matchingEntries = allowListEntries.filter((entry) =>
        invitedEmails.includes(entry.email),
      );
      expect(matchingEntries).toHaveLength(3);

      // Verify all have the correct roleId
      matchingEntries.forEach((entry) => {
        const metadata = entry.metadata as any;
        expect(metadata.roleId).toBe(ROLES.MEMBER.id);
      });

      // Cleanup
      onTestFinished(async () => {
        for (const entry of matchingEntries) {
          await db.delete(allowList).where(eq(allowList.id, entry.id));
        }
      });
    });

    it('should prevent duplicate invites', async ({ task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test-invite.com',
      });

      const { session } = await createIsolatedSession(adminUser.email);

      const inviteeEmail = `${task.id}-duplicate@example.com`;

      // First invite
      const result1 = await inviteUsersToOrganization({
        emails: [inviteeEmail],
        roleId: ROLES.MEMBER.id,
        organizationId: organization.id,
        user: session.user,
      });

      expect(result1.success).toBe(true);

      // Second invite to same email should skip
      const result2 = await inviteUsersToOrganization({
        emails: [inviteeEmail],
        roleId: ROLES.MEMBER.id,
        organizationId: organization.id,
        user: session.user,
      });

      expect(result2.success).toBe(true);

      // Should only have one allowList entry
      const allowListEntries = await db.query.allowList.findMany({
        where: (table, { eq }) => eq(table.email, inviteeEmail),
      });

      expect(allowListEntries).toHaveLength(1);

      // Cleanup
      onTestFinished(async () => {
        for (const entry of allowListEntries) {
          await db.delete(allowList).where(eq(allowList.id, entry.id));
        }
      });
    });
  });

  describe.concurrent('Inviting Existing Users', () => {
    it('should directly add existing user to organization with correct role', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create org for inviter
      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'inviter-org.com',
      });

      // Create an existing user (in a different org)
      const { adminUser: existingUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'existing-user.com',
        organizationName: 'Existing User Org',
      });

      const { session } = await createIsolatedSession(adminUser.email);

      const result = await inviteUsersToOrganization({
        emails: [existingUser.email],
        roleId: ROLES.MEMBER.id,
        organizationId: organization.id,
        user: session.user,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(existingUser.email);

      // Verify user was added to organization
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, existingUser.authUserId),
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

      expect(orgUser).toBeDefined();
      expect(orgUser?.email).toBe(existingUser.email);
      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);

      // Should NOT create allowList entry for existing users
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, existingUser.email),
      });

      expect(allowListEntry).toBeUndefined();
    });

    it('should prevent duplicate organization membership', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create org with two users
      const { organization, adminUser, memberUsers } =
        await testData.createOrganization({
          users: { admin: 1, member: 1 },
          emailDomain: 'test-org.com',
        });

      const memberUser = memberUsers[0];
      if (!memberUser) {
        throw new Error('Failed to create member user');
      }

      const { session } = await createIsolatedSession(adminUser.email);

      // Try to invite user who is already a member
      const result = await inviteUsersToOrganization({
        emails: [memberUser.email],
        roleId: ROLES.ADMIN.id, // Try to upgrade role
        organizationId: organization.id,
        user: session.user,
      });

      expect(result.details?.failed).toHaveLength(1);
      expect(result.details?.failed[0]?.email).toBe(memberUser.email);
      expect(result.details?.failed[0]?.reason).toBe(
        'User is already a member of this organization',
      );
    });
  });

  describe.concurrent('Join Organization Flow', () => {
    it('should allow invited user to join with correct role from roleId', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test-org.com',
      });

      const { session } = await createIsolatedSession(adminUser.email);

      // Invite a new user
      const inviteeEmail = `${task.id}-joiner@example.com`;
      await inviteUsersToOrganization({
        emails: [inviteeEmail],
        roleId: ROLES.MEMBER.id,
        organizationId: organization.id,
        personalMessage: 'Join our organization!',
        user: session.user,
      });

      // Create the invitee user
      const authUser = await createTestUser(inviteeEmail).then(
        (res) => res.user,
      );

      if (!authUser) {
        throw new Error('Failed to create auth user');
      }

      // Register cleanup for this auth user
      onTestFinished(async () => {
        await supabaseTestAdminClient.auth.admin.deleteUser(authUser.id);
      });

      // Get the user record
      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.authUserId, authUser.id));

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

      // User joins organization
      const result = await joinOrganization({
        user: {
          id: userRecord.id,
          authUserId: authUser.id,
          email: inviteeEmail,
          name: null,
          profileId: userRecord.profileId,
          currentProfileId: userRecord.currentProfileId,
          createdAt: userRecord.createdAt,
          updatedAt: userRecord.updatedAt,
        },
        organization: fullOrg,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      // Verify user was added with correct role
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, authUser.id),
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

      expect(orgUser).toBeDefined();
      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(ROLES.MEMBER.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Member');

      // Cleanup allowList
      onTestFinished(async () => {
        await db.delete(allowList).where(eq(allowList.email, inviteeEmail));
      });
    });
  });

  describe.concurrent('Role System Integration', () => {
    it('should respect different role types in invites', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test-org.com',
      });

      const { session } = await createIsolatedSession(adminUser.email);

      // Invite as Admin
      const inviteeEmail = `${task.id}-admin-invite@example.com`;
      const result = await inviteUsersToOrganization({
        emails: [inviteeEmail],
        roleId: ROLES.ADMIN.id,
        organizationId: organization.id,
        user: session.user,
      });

      expect(result.success).toBe(true);

      // Verify allowList has correct roleId
      const allowListEntry = await db.query.allowList.findFirst({
        where: (table, { eq }) => eq(table.email, inviteeEmail),
      });

      const metadata = allowListEntry?.metadata as any;
      expect(metadata.roleId).toBe(ROLES.ADMIN.id);

      // Create and join as the invitee
      const authUser = await createTestUser(inviteeEmail).then(
        (res) => res.user,
      );

      if (!authUser) {
        throw new Error('Failed to create auth user');
      }

      onTestFinished(async () => {
        await supabaseTestAdminClient.auth.admin.deleteUser(authUser.id);
      });

      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.authUserId, authUser.id));

      if (!userRecord) {
        throw new Error('User record not found');
      }

      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      await joinOrganization({
        user: {
          id: userRecord.id,
          authUserId: authUser.id,
          email: inviteeEmail,
          name: null,
          profileId: userRecord.profileId,
          currentProfileId: userRecord.currentProfileId,
          createdAt: userRecord.createdAt,
          updatedAt: userRecord.updatedAt,
        },
        organization: fullOrg,
      });

      // Verify correct role was assigned
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, authUser.id),
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

      expect(orgUser?.roles[0]?.accessRole.id).toBe(ROLES.ADMIN.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Admin');

      // Cleanup allowList
      onTestFinished(async () => {
        await db.delete(allowList).where(eq(allowList.email, inviteeEmail));
      });
    });
  });

  describe.concurrent('Error Scenarios', () => {
    it('should prevent join without proper access', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      // Create an organization with a domain
      const { organization } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'company.com',
      });

      // Set organization domain
      await db
        .update(organizations)
        .set({ domain: 'company.com' })
        .where(eq(organizations.id, organization.id));

      // Create user with different domain (not invited)
      const outsiderEmail = `${task.id}-outsider@different-domain.com`;
      const authUser = await createTestUser(outsiderEmail).then(
        (res) => res.user,
      );

      if (!authUser) {
        throw new Error('Failed to create auth user');
      }

      onTestFinished(async () => {
        await supabaseTestAdminClient.auth.admin.deleteUser(authUser.id);
      });

      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.authUserId, authUser.id));

      if (!userRecord) {
        throw new Error('User record not found');
      }

      const fullOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, organization.id),
      });

      if (!fullOrg) {
        throw new Error('Organization not found');
      }

      await expect(
        joinOrganization({
          user: {
            id: userRecord.id,
            authUserId: authUser.id,
            email: outsiderEmail,
            name: null,
            profileId: userRecord.profileId,
            currentProfileId: userRecord.currentProfileId,
            createdAt: userRecord.createdAt,
            updatedAt: userRecord.updatedAt,
          },
          organization: fullOrg,
        }),
      ).rejects.toThrow(
        'Your email does not have access to join this organization',
      );
    });

    it('should handle invalid role ID gracefully', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);

      const { organization, adminUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'test-org.com',
      });

      // Create an existing user in a different org
      const { adminUser: existingUser } = await testData.createOrganization({
        users: { admin: 1 },
        emailDomain: 'other-org.com',
        organizationName: 'Other Org',
      });

      const { session } = await createIsolatedSession(adminUser.email);

      const invalidRoleId = '00000000-0000-0000-0000-000000000000';

      const result = await inviteUsersToOrganization({
        emails: [existingUser.email],
        roleId: invalidRoleId,
        organizationId: organization.id,
        user: session.user,
      });

      // Should fail because role is invalid when adding existing user
      expect(result.details?.failed).toHaveLength(1);
      expect(result.details?.failed[0]?.reason).toBe(
        'Invalid role specified for organization invite',
      );
    });
  });
});

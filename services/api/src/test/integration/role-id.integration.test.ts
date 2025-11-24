import { getRoles, joinOrganization } from '@op/common';
import { db } from '@op/db/client';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  insertTestData,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe.skip('Role ID System Integration Tests', () => {
  let testUser: any;
  let testOrgId: string;
  let roles: any[];

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'organization_user_to_access_roles',
      'organization_users',
      'allow_list',
      'access_roles',
      'organizations',
      'profiles',
    ]);
    await signOutTestUser();

    // Create test user
    const testEmail = `role-test-${Date.now()}@example.com`;
    await createTestUser(testEmail);
    await signInTestUser(testEmail);
    const session = await getCurrentTestSession();
    testUser = session?.user;

    // Create test roles directly in database
    const testRoles = await insertTestData('access_roles', [
      {
        name: 'Admin',
        description: 'Full administrative access',
      },
      {
        name: 'Editor',
        description: 'Can edit content',
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
      },
    ]);

    roles = testRoles;

    // Create test organization and profile
    const testProfiles = await insertTestData('profiles', [
      {
        name: 'Test Role Organization',
        slug: `test-role-org-${Date.now()}`,
        email: 'test@roleorg.com',
        website: 'https://roleorg.com',
        bio: 'Testing role functionality',
      },
    ]);

    const testOrganizations = await insertTestData('organizations', [
      {
        domain: 'roleorg.com',
        profile_id: testProfiles[0].id,
        org_type: 'nonprofit',
        network_organization: false,
        is_receiving_funds: false,
        is_offering_funds: false,
        accepting_applications: false,
      },
    ]);

    testOrgId = testOrganizations[0].id;
  });

  describe('getRoles functionality', () => {
    it('should return all available roles with IDs', async () => {
      const result = await getRoles();

      expect(result.roles).toBeDefined();
      expect(result.roles.length).toBeGreaterThanOrEqual(3);

      // Verify structure
      result.roles.forEach((role) => {
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(typeof role.id).toBe('string');
        expect(typeof role.name).toBe('string');
        expect(role.description).toBeDefined(); // Can be null
      });

      // Verify specific roles exist
      const roleNames = result.roles.map((r) => r.name);
      expect(roleNames).toContain('Admin');
      expect(roleNames).toContain('Editor');
      expect(roleNames).toContain('Viewer');
    });

    it('should return roles sorted by name', async () => {
      const result = await getRoles();

      const roleNames = result.roles.map((r) => r.name);
      const sortedNames = [...roleNames].sort();

      expect(roleNames).toEqual(sortedNames);
    });
  });

  describe('Role assignment with IDs', () => {
    it('should assign role by ID during organization join', async () => {
      const adminRole = roles.find((r) => r.name === 'Admin');
      const viewerRole = roles.find((r) => r.name === 'Viewer');

      // Create allowList entry with specific roleId
      await insertTestData('allow_list', [
        {
          email: testUser.email,
          organization_id: testOrgId,
          metadata: {
            roleId: viewerRole.id, // Assign Viewer role instead of Admin
            inviteType: 'existing_organization',
            invitedBy: testUser.id,
            invitedAt: new Date().toISOString(),
          },
        },
      ]);

      // User joins organization
      const result = await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();

      // Verify user got Viewer role, not Admin
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, testUser.id),
            eq(table.organizationId, testOrgId),
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
      expect(orgUser?.roles[0]?.accessRole.id).toBe(viewerRole.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Viewer');
    });

    it('should update currentProfileId only for admin role assignments', async () => {
      const adminRole = roles.find((r) => r.name === 'Admin');

      // Get user's initial currentProfileId
      const initialUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });
      const initialCurrentProfileId = initialUser?.currentProfileId;

      // Create allowList entry with Admin roleId
      await insertTestData('allow_list', [
        {
          email: testUser.email,
          organization_id: testOrgId,
          metadata: {
            roleId: adminRole.id,
            inviteType: 'existing_organization',
            invitedBy: testUser.id,
            invitedAt: new Date().toISOString(),
          },
        },
      ]);

      // User joins organization
      await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      // Verify user's currentProfileId was updated since they joined as Admin
      const updatedUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });

      // Get the organization to verify currentProfileId was set to org's profileId
      const org = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.id, testOrgId),
      });

      expect(updatedUser?.currentProfileId).toBe(org?.profileId);
      expect(updatedUser?.currentProfileId).not.toBe(initialCurrentProfileId);
    });

    it('should NOT update currentProfileId for non-admin role assignments', async () => {
      const viewerRole = roles.find((r) => r.name === 'Viewer');

      // Get user's initial currentProfileId
      const initialUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });
      const initialCurrentProfileId = initialUser?.currentProfileId;

      // Create allowList entry with Viewer roleId (non-admin)
      await insertTestData('allow_list', [
        {
          email: testUser.email,
          organization_id: testOrgId,
          metadata: {
            roleId: viewerRole.id,
            inviteType: 'existing_organization',
            invitedBy: testUser.id,
            invitedAt: new Date().toISOString(),
          },
        },
      ]);

      // User joins organization
      await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      // Verify user's currentProfileId was NOT updated since they joined as non-admin
      const updatedUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });

      expect(updatedUser?.currentProfileId).toBe(initialCurrentProfileId);
    });

    it('should fallback to Admin when roleId is invalid', async () => {
      const adminRole = roles.find((r) => r.name === 'Admin');

      // Get user's initial currentProfileId
      const initialUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });
      const initialCurrentProfileId = initialUser?.currentProfileId;

      // Create allowList entry with invalid roleId
      await insertTestData('allow_list', [
        {
          email: testUser.email,
          organization_id: testOrgId,
          metadata: {
            roleId: '00000000-0000-0000-0000-000000000000', // Invalid ID
            inviteType: 'existing_organization',
            invitedBy: testUser.id,
            invitedAt: new Date().toISOString(),
          },
        },
      ]);

      // User joins organization
      const result = await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      expect(result).toBeDefined();

      // Verify user got Admin role as fallback
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, testUser.id),
            eq(table.organizationId, testOrgId),
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

      // Since they got Admin role as fallback, currentProfileId should be updated
      const updatedUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });

      const org = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.id, testOrgId),
      });

      expect(updatedUser?.currentProfileId).toBe(org?.profileId);
      expect(updatedUser?.currentProfileId).not.toBe(initialCurrentProfileId);
    });

    it('should fallback to Admin for domain-based joins without roleId', async () => {
      // Get user's initial currentProfileId
      const initialUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });
      const initialCurrentProfileId = initialUser?.currentProfileId;

      // User joins via domain matching (no allowList entry)
      const result = await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      expect(result).toBeDefined();

      // Verify user got Admin role
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, testUser.id),
            eq(table.organizationId, testOrgId),
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

      // Since they got Admin role via fallback, currentProfileId should be updated
      const updatedUser = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, testUser.id),
      });

      const org = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.id, testOrgId),
      });

      expect(updatedUser?.currentProfileId).toBe(org?.profileId);
      expect(updatedUser?.currentProfileId).not.toBe(initialCurrentProfileId);
    });
  });

  describe('Role persistence through renames', () => {
    it('should maintain role assignment even if role name changes', async () => {
      const editorRole = roles.find((r) => r.name === 'Editor');

      // Create allowList entry with Editor roleId
      await insertTestData('allow_list', [
        {
          email: testUser.email,
          organization_id: testOrgId,
          metadata: {
            roleId: editorRole.id,
            inviteType: 'existing_organization',
            invitedBy: testUser.id,
            invitedAt: new Date().toISOString(),
          },
        },
      ]);

      // User joins organization
      await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      // Simulate role name change
      await db
        .update(db.schema.accessRoles)
        .set({ name: 'Content Manager' }) // Rename Editor to Content Manager
        .where(db.schema.eq(db.schema.accessRoles.id, editorRole.id));

      // Verify user still has correct role by ID
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, testUser.id),
            eq(table.organizationId, testOrgId),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles[0]?.accessRole.id).toBe(editorRole.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Content Manager'); // New name
    });
  });

  describe('Multiple role scenarios', () => {
    it('should handle organization with custom roles', async () => {
      // Add a custom role for this organization
      const customRoles = await insertTestData('access_roles', [
        {
          name: 'Project Manager',
          description: 'Manages specific projects',
        },
      ]);

      const projectManagerRole = customRoles[0];

      // Create allowList entry with custom role
      await insertTestData('allow_list', [
        {
          email: testUser.email,
          organization_id: testOrgId,
          metadata: {
            roleId: projectManagerRole.id,
            inviteType: 'existing_organization',
            invitedBy: testUser.id,
            invitedAt: new Date().toISOString(),
          },
        },
      ]);

      // User joins organization
      const result = await joinOrganization({
        user: testUser,
        organizationId: testOrgId,
      });

      expect(result).toBeDefined();

      // Verify user got the custom role
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { and, eq }) =>
          and(
            eq(table.authUserId, testUser.id),
            eq(table.organizationId, testOrgId),
          ),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles[0]?.accessRole.id).toBe(projectManagerRole.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Project Manager');
    });
  });

  describe('Data integrity', () => {
    it('should maintain referential integrity between roles and assignments', async () => {
      const editorRole = roles.find((r) => r.name === 'Editor');

      // Create organization user with role
      const orgUsers = await insertTestData('organization_users', [
        {
          auth_user_id: testUser.id,
          organization_id: testOrgId,
          email: testUser.email,
          name: 'Test User',
        },
      ]);

      // Assign role
      await insertTestData('organization_user_to_access_roles', [
        {
          organization_user_id: orgUsers[0].id,
          access_role_id: editorRole.id,
        },
      ]);

      // Verify the relationship exists
      const orgUser = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, orgUsers[0].id),
        with: {
          roles: {
            with: {
              accessRole: true,
            },
          },
        },
      });

      expect(orgUser?.roles).toHaveLength(1);
      expect(orgUser?.roles[0]?.accessRole.id).toBe(editorRole.id);
      expect(orgUser?.roles[0]?.accessRole.name).toBe('Editor');

      // Verify cascade behavior - deleting role assignment doesn't delete user
      await db
        .delete(db.schema.organizationUserToAccessRoles)
        .where(
          db.schema.eq(
            db.schema.organizationUserToAccessRoles.organizationUserId,
            orgUsers[0].id,
          ),
        );

      const orgUserAfterDelete = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, orgUsers[0].id),
        with: {
          roles: true,
        },
      });

      expect(orgUserAfterDelete).toBeDefined();
      expect(orgUserAfterDelete?.roles).toHaveLength(0);
    });
  });
});


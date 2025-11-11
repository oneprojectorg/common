import { createOrganization } from '@op/common';
import { db } from '@op/db/client';
import { accessRoles, organizationUserToAccessRoles } from '@op/db/schema';
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

describe('List Organization Users Integration Tests', () => {
  let testUserEmail: string;
  let testUser: any;
  let organizationId: string;
  let profileId: string;
  let createCaller: ReturnType<typeof createCallerFactory>;

  const createTestContext = (user: any) => ({
    user,
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    res: {} as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    isServerSideCall: true, // Skip rate limiting in tests
  });

  beforeEach(async () => {
    // Clean up before each test (but NOT access_roles - those are needed by createOrganization)
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
    ]);
    await signOutTestUser();

    // Ensure Admin role exists (required by createOrganization)
    await db
      .insert(accessRoles)
      .values({
        name: 'Admin',
        description: 'Administrator role with full permissions',
      })
      .onConflictDoNothing();

    // Create fresh test user for each test
    testUserEmail = `test-users-${Date.now()}@example.com`;
    await createTestUser(testUserEmail);
    await signInTestUser(testUserEmail);

    // Get the authenticated user for service calls
    const session = await getCurrentTestSession();
    testUser = session?.user;

    // Create a test organization
    const organizationData = {
      name: 'Test Organization for Users',
      website: 'https://test-users.org',
      email: 'contact@test-users.org',
      orgType: 'nonprofit',
      bio: 'A test organization for user management',
      mission: 'To test user listing functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const organization = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    organizationId = organization.id;
    profileId = organization.profile.id;

    // Create tRPC caller
    createCaller = createCallerFactory(organizationRouter);
  });

  it('should successfully list organization users with admin permissions', async () => {
    const caller = createCaller(createTestContext(testUser));

    const result = await caller.listUsers({
      profileId: profileId,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Check the creator is in the list
    const creator = result.find((user) => user.authUserId === testUser.id);
    expect(creator).toBeDefined();
    expect(creator?.email).toBe(testUserEmail);
    expect(creator?.organizationId).toBe(organizationId);
    expect(Array.isArray(creator?.roles)).toBe(true);
    // Profile data should be included
    expect(creator?.profile).toBeDefined();
  });

  it('should throw unauthorized error for non-members', async () => {
    // Create another test user
    const nonMemberEmail = `non-member-${Date.now()}@example.com`;
    await createTestUser(nonMemberEmail);
    await signInTestUser(nonMemberEmail);
    const nonMemberSession = await getCurrentTestSession();
    const nonMemberUser = nonMemberSession?.user;

    const caller = createCaller(createTestContext(nonMemberUser));

    await expect(async () => {
      await caller.listUsers({
        profileId: organizationId,
      });
    }).rejects.toThrow(/permission/i);
  });

  it('should return array with creator for organization with no additional members', async () => {
    const caller = createCaller(createTestContext(testUser));

    const result = await caller.listUsers({
      profileId: profileId,
    });

    // Should contain at least the creator
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].authUserId).toBe(testUser.id);
  });

  it('should correctly return users with multiple roles', async () => {
    // Get or create access roles
    // Try to insert Admin role, ignore if exists
    await db
      .insert(accessRoles)
      .values({
        name: 'Admin',
        description: 'Administrator role',
      })
      .onConflictDoNothing();

    // Try to insert Editor role, ignore if exists
    await db
      .insert(accessRoles)
      .values({
        name: 'Editor',
        description: 'Editor role',
      })
      .onConflictDoNothing();

    // Fetch the roles
    const adminRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, 'Admin'),
    });

    const editorRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, 'Editor'),
    });

    if (!adminRole || !editorRole) {
      throw new Error('Failed to get or create roles');
    }

    // Get the organization user
    const orgUser = await db.query.organizationUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.authUserId, testUser.id),
        ),
    });

    if (orgUser) {
      // Add multiple roles to the user (Admin might already be assigned by createOrganization)
      await db
        .insert(organizationUserToAccessRoles)
        .values([
          {
            organizationUserId: orgUser.id,
            accessRoleId: adminRole.id,
          },
          {
            organizationUserId: orgUser.id,
            accessRoleId: editorRole.id,
          },
        ])
        .onConflictDoNothing();
    }

    const caller = createCaller(createTestContext(testUser));

    const result = await caller.listUsers({
      profileId: profileId,
    });

    expect(result).toBeDefined();
    expect(result.length).toBe(1);

    const userWithRoles = result[0];
    expect(userWithRoles.roles).toBeDefined();
    expect(userWithRoles.roles.length).toBe(2);

    const roleNames = userWithRoles.roles.map((role) => role.name).sort();
    expect(roleNames).toEqual(['Admin', 'Editor']);
  });

  it('should throw error for invalid profile ID', async () => {
    const caller = createCaller(createTestContext(testUser));

    await expect(async () => {
      await caller.listUsers({
        profileId: '00000000-0000-0000-0000-000000000000',
      });
    }).rejects.toThrow();
  });
});

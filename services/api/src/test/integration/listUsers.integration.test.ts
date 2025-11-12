import { db } from '@op/db/client';
import {
  Organization,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
} from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import {
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
  supabaseTestAdminClient,
} from '../supabase-utils';

interface SeedUserInput {
  email: string;
  role: 'Admin' | 'Member';
}

interface GenerateTestOrganizationOptions {
  users?: {
    admin?: number;
    member?: number;
  };
  organizationName?: string;
}

interface GeneratedUser {
  authUserId: string;
  email: string;
  organizationUserId: string;
  role: 'Admin' | 'Member';
}

interface GenerateTestOrganizationOutput {
  organization: Organization;
  organizationProfile: any;
  adminUser: GeneratedUser;
  adminUsers: GeneratedUser[];
  memberUsers: GeneratedUser[];
  allUsers: GeneratedUser[];
}

/**
 * Generates a test organization with members of specified roles.
 * Assumes access_zones, access_roles, and access_role_permissions_on_access_zones already exist.
 *
 * @param testId - The test ID (from vitest's task.id)
 * @param opts - Options for organization and user creation
 * @returns Organization with categorized users by role
 *
 * @example
 * const { organization, adminUsers, memberUsers } = await generateTestOrganizationWithMembers(task.id, {
 *   users: { admin: 2, member: 3, editor: 1 },
 *   organizationName: "Test Org"
 * });
 */
async function generateTestOrganizationWithMembers(
  testId: string,
  opts?: GenerateTestOrganizationOptions,
): Promise<GenerateTestOrganizationOutput> {
  const {
    users: userCounts = { admin: 1, member: 0 },
    organizationName = 'Test Org',
  } = opts || {};

  const orgNameWithTestId = `${organizationName}-${testId}`;

  // 1. Create organization profile (minimal - only required fields)
  const [orgProfile] = await db
    .insert(profiles)
    .values({
      name: orgNameWithTestId,
      slug: `${orgNameWithTestId.toLowerCase().replace(/\s+/g, '-')}-${randomUUID()}`,
    })
    .returning();

  if (!orgProfile) {
    throw new Error('Failed to create organization profile');
  }

  // 2. Create organization (minimal - only required fields)
  const [organization] = await db
    .insert(organizations)
    .values({
      profileId: orgProfile.id,
    })
    .returning();

  if (!organization) {
    throw new Error('Failed to create organization');
  }

  const adminUsers: GeneratedUser[] = [];
  const memberUsers: GeneratedUser[] = [];

  // Helper function to create a user with a specific role
  const createUserWithRole = async (
    role: 'Admin' | 'Member',
  ): Promise<GeneratedUser> => {
    const { email } = generateTestUserWithRole(testId, role);

    // Create auth user via Supabase Admin API
    const authUser = await createTestUser(email).then((res) => res.user);

    if (!authUser || !authUser.email) {
      throw new Error(`Failed to create auth user for ${email}`);
    }

    // Create user profile (minimal - only required fields)
    const username = email.split('@')[0] || 'user';
    const [userProfile] = await db
      .insert(profiles)
      .values({
        name: username,
        slug: `${username}-${randomUUID()}`,
      })
      .returning();

    if (!userProfile) {
      throw new Error(`Failed to create profile for ${email}`);
    }

    // Create user in users table (minimal - only required fields)
    await db
      .insert(users)
      .values({
        authUserId: authUser.id,
        email: authUser.email!,
      })
      .onConflictDoUpdate({
        target: [users.email],
        set: {
          authUserId: authUser.id,
        },
      });

    // Create organization user (minimal - only required fields)
    const [orgUser] = await db
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        authUserId: authUser.id,
        email: authUser.email,
      })
      .returning();

    if (!orgUser) {
      throw new Error(`Failed to create organization user for ${email}`);
    }

    // Get the role from access_roles
    // TODO: we should get it from seed data
    const accessRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, role),
    });

    if (!accessRole) {
      throw new Error(`Role ${role} not found in access_roles table`);
    }

    // Assign role to organization user
    await db.insert(organizationUserToAccessRoles).values({
      organizationUserId: orgUser.id,
      accessRoleId: accessRole.id,
    });

    return {
      authUserId: authUser.id,
      email: authUser.email!,
      organizationUserId: orgUser.id,
      role,
    };
  };

  // 3. Create admin users
  for (let i = 0; i < (userCounts.admin || 1); i++) {
    const user = await createUserWithRole('Admin');
    adminUsers.push(user);
  }

  // 4. Create member users
  for (let i = 0; i < (userCounts.member || 0); i++) {
    const user = await createUserWithRole('Member');
    memberUsers.push(user);
  }

  const [adminUser] = adminUsers;
  if (!adminUser) {
    throw new Error(
      'At least one admin user is required to create the organization',
    );
  }

  return {
    organization,
    organizationProfile: orgProfile,
    adminUsers,
    adminUser,
    memberUsers,
    allUsers: [...adminUsers, ...memberUsers],
  };
}

/**
 * Generates an email/role pair for test users based on task ID and role.
 * Ensures consistent email generation across tests.
 * Supports multiple users per role by adding a random suffix.
 *
 * @param taskId - The test task ID (from vitest's task.id)
 * @param role - The role to assign to the user
 * @returns An object with email and role properties
 *
 * @example
 * const adminUser = generateTestUserWithRole(task.id, 'Admin');
 * // Returns: { email: 'test-users-123-admin-a1b2c3@oneproject.org', role: 'Admin' }
 */
function generateTestUserWithRole(
  taskId: string,
  role: 'Admin' | 'Member',
): SeedUserInput {
  const randomSuffix = randomUUID().slice(0, 6);
  return {
    email: `test-users-${taskId}-${role.toLowerCase()}-${randomSuffix}@oneproject.org`,
    role,
  };
}

/**
 * Cleans up test data by deleting profiles and auth users created for a specific test.
 * Relies on database cascade deletes to automatically clean up related records:
 * - Deleting profiles cascades to organizations, which cascades to organizationUsers and roles
 * - Deleting auth users cascades to users and organizationUsers tables
 *
 * @param testId - The test ID (from vitest's task.id)
 *
 * @example
 * afterEach(async ({ task }) => {
 *   await cleanupTestOrganization(task.id);
 * });
 */
async function cleanupTestOrganization(testId: string): Promise<void> {
  if (!supabaseTestAdminClient) {
    console.warn('Supabase admin test client not initialized');
    return;
  }

  try {
    // 1. Delete profiles with the test ID in the name
    // This will cascade to organizations -> organizationUsers -> organizationUserToAccessRoles
    await db
      .delete(profiles)
      .where(sql`${profiles.name} LIKE ${'%' + testId + '%'}`);

    // 2. Delete auth users with the test ID in the email
    // This will cascade to users and organizationUsers tables
    const { data: authUsers } =
      await supabaseTestAdminClient.auth.admin.listUsers();
    if (authUsers?.users) {
      const testUsers = authUsers.users.filter((user) =>
        user.email?.includes(testId),
      );
      await Promise.allSettled(
        testUsers.map((user) =>
          supabaseTestAdminClient.auth.admin.deleteUser(user.id),
        ),
      );
    }
  } catch (error) {
    console.warn(
      `Failed to cleanup test organization for test ${testId}:`,
      error,
    );
  }
}

describe('List Organization Users Integration Tests', () => {
  const createCaller: ReturnType<typeof createCallerFactory> =
    createCallerFactory(organizationRouter);

  const createTestContext = (jwt: string) => ({
    jwt,
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    res: {} as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    isServerSideCall: true, // Skip rate limiting in tests
    getCookies: () => ({}),
  });

  it('should successfully list organization users', async ({ task }) => {
    // Use generateTestOrganizationWithMembers to create organization and users
    const { organization, adminUser, memberUsers } =
      await generateTestOrganizationWithMembers(task.id, {
        users: { admin: 1, member: 1 },
      });
    onTestFinished(() => cleanupTestOrganization(task.id));

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }

    // @ts-expect-error - Test context uses simplified structure
    const caller = createCaller(createTestContext(session!.access_token));

    // TODO:
    // if (!('listUsers' in caller) || typeof caller.listUsers !== 'function') {
    //   throw new Error('listUsers procedure not found in organizationRouter');
    // }

    const result = await caller.listUsers({
      profileId: organization.profileId,
    });

    expect(result).toMatchObject([
      {
        email: adminUser.email,
      },
      ...memberUsers.map((m) => ({
        email: m.email,
      })),
    ]);
  });

  it('should correctly return users with multiple roles', async ({ task }) => {
    // TODO: we should get the role from seed data
    const { organization, adminUser, memberUsers } =
      await generateTestOrganizationWithMembers(task.id, {
        users: { admin: 1, member: 1 },
      });
    onTestFinished(() => cleanupTestOrganization(task.id));

    // Get the organization user
    const orgUser = await db.query.organizationUsers.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.organizationId, organization.id),
          eq(table.authUserId, adminUser.authUserId),
        ),
    });

    if (!orgUser) {
      throw new Error('Organization user not found for admin user');
    }

    const memberRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, 'Member'),
    });

    if (!memberRole) {
      throw new Error('Member role not found');
    }

    // Add multiple roles to the user
    await db.insert(organizationUserToAccessRoles).values([
      {
        organizationUserId: orgUser.id,
        accessRoleId: memberRole.id,
      },
    ]);

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }
    const caller = createCaller(createTestContext(session.access_token));
    const result = await caller.listUsers({
      profileId: organization.profileId,
    });

    expect(result.length).toBe(2);

    const userWithRoles = result.find((user) => user.email === adminUser.email);
    expect(userWithRoles).toBeDefined();
    expect(userWithRoles.roles).toMatchObject([
      { name: 'Admin' },
      { name: 'Member' },
    ]);
  });

  it('should throw error for invalid profile ID', async ({ task }) => {
    // Use generateTestOrganizationWithMembers to create organization and users
    const { adminUser } = await generateTestOrganizationWithMembers(task.id);

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(adminUser.email);
    const session = await getCurrentTestSession();
    if (!session) {
      throw new Error('No session found for test user');
    }
    const caller = createCaller(createTestContext(session.access_token));
    expect(async () => {
      await caller.listUsers({
        profileId: '00000000-0000-0000-0000-000000000000',
      });
    }).rejects.toThrow();
  });
});

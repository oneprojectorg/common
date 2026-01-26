/**
 * Shared Test Data Utilities
 *
 * Pure functions for creating test data that can be reused across
 * different test environments (Vitest, Playwright E2E).
 *
 * These functions are intentionally stateless and take all dependencies
 * as parameters to work with any Supabase client instance.
 */
import { db } from '@op/db';
import {
  type Organization,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/**
 * Default password used for test users.
 * Must be strong enough to pass Supabase's password requirements.
 */
export const TEST_USER_DEFAULT_PASSWORD = 'Test_Password_123!';

// ============================================================================
// Types
// ============================================================================

export interface GeneratedUser {
  authUserId: string;
  email: string;
  organizationUserId: string;
  profileId: string;
  role: 'Admin' | 'Member';
}

export interface CreateOrganizationOptions {
  /** Unique identifier for this test run (used in names/emails) */
  testId: string;
  /** Supabase admin client for creating auth users */
  supabaseAdmin: SupabaseClient;
  /** Number of users to create by role */
  users?: {
    admin?: number;
    member?: number;
  };
  /** Base name for the organization (testId will be appended) */
  organizationName?: string;
  /** Email domain for generated users */
  emailDomain?: string;
}

export interface CreateOrganizationResult {
  organization: Organization;
  organizationProfile: typeof profiles.$inferSelect;
  adminUser: GeneratedUser;
  adminUsers: GeneratedUser[];
  memberUsers: GeneratedUser[];
  allUsers: GeneratedUser[];
  /** IDs of all created resources for cleanup */
  createdIds: {
    profileIds: string[];
    authUserIds: string[];
    organizationUserIds: string[];
  };
}

export interface CreateTestUserOptions {
  supabaseAdmin: SupabaseClient;
  email: string;
  password?: string;
}

export interface CreateTestUserResult {
  user: {
    id: string;
    email: string;
  };
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Creates a test user via Supabase admin API.
 * This bypasses email confirmation and creates a ready-to-use user.
 */
export async function createTestUser(
  opts: CreateTestUserOptions,
): Promise<CreateTestUserResult> {
  const { supabaseAdmin, email, password = TEST_USER_DEFAULT_PASSWORD } = opts;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error(`No user returned when creating test user: ${email}`);
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
    },
  };
}

/**
 * Generates a unique email for a test user.
 */
export function generateTestEmail(
  testId: string,
  role: 'Admin' | 'Member',
  emailDomain: string = 'oneproject.org',
): string {
  const randomSuffix = randomUUID().slice(0, 6);
  return `${testId}-${role.toLowerCase()}-${randomSuffix}@${emailDomain}`;
}

/**
 * Creates a test organization with users.
 *
 * Returns all created IDs for cleanup by the caller.
 */
export async function createOrganization(
  opts: CreateOrganizationOptions,
): Promise<CreateOrganizationResult> {
  const {
    testId,
    supabaseAdmin,
    users: userCounts = { admin: 1, member: 0 },
    organizationName = 'Test Org',
    emailDomain = 'oneproject.org',
  } = opts;

  const createdIds = {
    profileIds: [] as string[],
    authUserIds: [] as string[],
    organizationUserIds: [] as string[],
  };

  const orgNameWithTestId = `${organizationName}-${testId}`;

  // 1. Create organization profile
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

  createdIds.profileIds.push(orgProfile.id);

  // 2. Create organization
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

  // Helper to create user with role
  const createUserWithRole = async (
    role: 'Admin' | 'Member',
  ): Promise<GeneratedUser> => {
    const email = generateTestEmail(testId, role, emailDomain);

    const { user: authUser } = await createTestUser({
      supabaseAdmin,
      email,
    });

    createdIds.authUserIds.push(authUser.id);

    // Get the user record created by trigger
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!userRecord) {
      throw new Error(`Failed to find user record for ${email}`);
    }

    // Track the profile created by the trigger
    if (userRecord.profileId) {
      createdIds.profileIds.push(userRecord.profileId);
    }

    // Create organization user
    const [orgUser] = await db
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        authUserId: authUser.id,
        email,
      })
      .returning();

    if (!orgUser) {
      throw new Error(`Failed to create organization user for ${email}`);
    }

    createdIds.organizationUserIds.push(orgUser.id);

    // Assign role
    const accessRoleId = role === 'Admin' ? ROLES.ADMIN.id : ROLES.MEMBER.id;
    await db.insert(organizationUserToAccessRoles).values({
      organizationUserId: orgUser.id,
      accessRoleId,
    });

    if (!userRecord.profileId) {
      throw new Error(`User record for ${email} is missing profileId`);
    }

    return {
      authUserId: authUser.id,
      email,
      organizationUserId: orgUser.id,
      profileId: userRecord.profileId,
      role,
    };
  };

  // 3. Create admin users
  for (let i = 0; i < (userCounts.admin ?? 1); i++) {
    const user = await createUserWithRole('Admin');
    adminUsers.push(user);
  }

  // 4. Create member users
  for (let i = 0; i < (userCounts.member ?? 0); i++) {
    const user = await createUserWithRole('Member');
    memberUsers.push(user);
  }

  const [adminUser] = adminUsers;
  if (!adminUser) {
    throw new Error('At least one admin user is required');
  }

  return {
    organization,
    organizationProfile: orgProfile,
    adminUsers,
    adminUser,
    memberUsers,
    allUsers: [...adminUsers, ...memberUsers],
    createdIds,
  };
}

/**
 * Adds an existing user to an organization.
 *
 * Returns the organization user ID for cleanup tracking.
 */
export async function addUserToOrganization(opts: {
  authUserId: string;
  organizationId: string;
  email: string;
  role?: 'Admin' | 'Member';
}): Promise<{
  orgUser: typeof organizationUsers.$inferSelect;
  organizationUserId: string;
}> {
  const { authUserId, organizationId, email, role = 'Member' } = opts;

  const [orgUser] = await db
    .insert(organizationUsers)
    .values({
      authUserId,
      organizationId,
      email,
    })
    .returning();

  if (!orgUser) {
    throw new Error('Failed to add user to organization');
  }

  // Assign role
  const accessRoleId = role === 'Admin' ? ROLES.ADMIN.id : ROLES.MEMBER.id;
  await db.insert(organizationUserToAccessRoles).values({
    organizationUserId: orgUser.id,
    accessRoleId,
  });

  return {
    orgUser,
    organizationUserId: orgUser.id,
  };
}

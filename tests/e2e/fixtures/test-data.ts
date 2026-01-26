/**
 * E2E Test Data Utilities
 *
 * Simple utility functions for creating test data in E2E tests.
 * Intentionally separate from Vitest data managers to avoid coupling to Vitest setup.
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

import { TEST_USER_DEFAULT_PASSWORD } from './auth';

interface GeneratedUser {
  authUserId: string;
  email: string;
  organizationUserId: string;
  profileId: string;
  role: 'Admin' | 'Member';
}

interface CreateOrganizationOptions {
  testId: string;
  supabaseAdmin: SupabaseClient;
  users?: {
    admin?: number;
    member?: number;
  };
  organizationName?: string;
  emailDomain?: string;
}

interface CreateOrganizationResult {
  organization: Organization;
  organizationProfile: typeof profiles.$inferSelect;
  adminUser: GeneratedUser;
  adminUsers: GeneratedUser[];
  memberUsers: GeneratedUser[];
  allUsers: GeneratedUser[];
}

/**
 * Creates a test user via Supabase admin API.
 */
export async function createTestUser(
  supabaseAdmin: SupabaseClient,
  email: string,
  password: string = TEST_USER_DEFAULT_PASSWORD,
) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return data;
}

/**
 * Creates a test organization with users.
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
    const randomSuffix = randomUUID().slice(0, 6);
    const email = `${testId}-${role.toLowerCase()}-${randomSuffix}@${emailDomain}`;

    const authUser = await createTestUser(supabaseAdmin, email);

    if (!authUser.user) {
      throw new Error(`Failed to create auth user for ${email}`);
    }

    // Get the user record created by trigger
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.user.id));

    if (!userRecord) {
      throw new Error(`Failed to find user record for ${email}`);
    }

    // Create organization user
    const [orgUser] = await db
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        authUserId: authUser.user.id,
        email,
      })
      .returning();

    if (!orgUser) {
      throw new Error(`Failed to create organization user for ${email}`);
    }

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
      authUserId: authUser.user.id,
      email,
      organizationUserId: orgUser.id,
      profileId: userRecord.profileId,
      role,
    };
  };

  // Create admin users
  for (let i = 0; i < (userCounts.admin || 1); i++) {
    const user = await createUserWithRole('Admin');
    adminUsers.push(user);
  }

  // Create member users
  for (let i = 0; i < (userCounts.member || 0); i++) {
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
  };
}

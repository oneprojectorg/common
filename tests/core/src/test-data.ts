import {
  type Organization,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const TEST_USER_DEFAULT_PASSWORD = 'Test_Password_123!';

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

export interface CreateUserOptions {
  supabaseAdmin: SupabaseClient;
  email: string;
  password?: string;
}

/** Creates a user via Supabase admin API, bypassing email confirmation. */
export async function createUser(opts: CreateUserOptions) {
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
    id: data.user.id,
    email: data.user.email ?? email,
  };
}

export function generateTestEmail(
  testId: string,
  role: 'Admin' | 'Member',
  emailDomain: string = 'oneproject.org',
): string {
  const randomSuffix = randomUUID().slice(0, 6);
  return `${testId}-${role.toLowerCase()}-${randomSuffix}@${emailDomain}`;
}

/** Creates a test organization with users. Returns created IDs for cleanup. */
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

    const authUser = await createUser({
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

export async function addUserToOrganization(opts: {
  authUserId: string;
  organizationId: string;
  email: string;
  role?: 'Admin' | 'Member';
}) {
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

  const accessRoleId = role === 'Admin' ? ROLES.ADMIN.id : ROLES.MEMBER.id;
  await db.insert(organizationUserToAccessRoles).values({
    organizationUserId: orgUser.id,
    accessRoleId,
  });

  return orgUser;
}

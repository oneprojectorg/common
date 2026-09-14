import {
  type Organization,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq, sql } from '@op/db/test';
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

  // Mark test users as onboarded (so they aren't redirected to /start) and as
  // having accepted the current policies (so the re-acceptance gate stays shut).
  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ onboardedAt: now, tosAcceptedOn: now, privacyAcceptedOn: now })
    .where(eq(users.authUserId, data.user.id));

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

/**
 * Detaches a phone number from whoever currently holds it, so a claim or login
 * flow can be run against that number again.
 *
 * Unlike an email address, a test cannot invent a fresh number: only the
 * numbers listed under `[auth.sms.test_otp]` skip the SMS provider, and GoTrue
 * refuses to attach one that is already on an account (`phone_exists`). The
 * database is not reset between local runs, so without this the second run of
 * a phone test fails on the account the first one created.
 *
 * Detaching rather than deleting: the previous run's account may have authored
 * proposals, and taking those with it would break unrelated specs.
 *
 * Only a confirmed number holds the reservation. A claim abandoned at the code
 * screen leaves the number in `phone_change`, which blocks nobody, and the
 * `phone_change` flow creates no `auth.identities` row to collide on either.
 */
export async function releaseTestPhoneNumber(phone: string): Promise<void> {
  // GoTrue stores E.164 without the leading `+`.
  const digits = phone.replace(/^\+/, '');

  await db.execute(sql`
    UPDATE auth.users
    SET phone = NULL, phone_confirmed_at = NULL
    WHERE phone = ${digits}
  `);
}

export interface TestAuthAccount {
  authUserId: string;
  /** Null for an account whose only credential is its phone number. */
  email: string | null;
  isAnonymous: boolean;
}

/**
 * The auth record holding `phone`, or null when the number is free.
 *
 * Read straight from the database rather than through
 * `supabaseAdmin.auth.admin.listUsers()`: that call pages at 50, and the e2e
 * database accumulates thousands of accounts, so a scan of the first page
 * answers "not found" for almost every number and quietly passes whatever it
 * was asked to prove.
 */
export async function findAuthUserByPhone(
  phone: string,
): Promise<TestAuthAccount | null> {
  const digits = phone.replace(/^\+/, '');

  const rows = await db.execute<{
    id: string;
    email: string | null;
    is_anonymous: boolean;
  }>(sql`
    SELECT id, email, is_anonymous
    FROM auth.users
    WHERE phone = ${digits}
  `);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    authUserId: row.id,
    // GoTrue stores an absent email as '', not NULL.
    email: row.email ? row.email : null,
    isAnonymous: row.is_anonymous,
  };
}

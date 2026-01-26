import { db } from '@op/db';
import {
  type Organization,
  accessRoles,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { test as base } from '@playwright/test';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/** Cache for role IDs looked up by name */
const roleIdCache: Map<string, string> = new Map();

/**
 * Looks up an access role ID by name, caching the result.
 * This allows tests to work with any database regardless of role UUIDs.
 */
async function getRoleIdByName(roleName: 'Admin' | 'Member'): Promise<string> {
  const cached = roleIdCache.get(roleName);
  if (cached) {
    return cached;
  }

  const [role] = await db
    .select({ id: accessRoles.id })
    .from(accessRoles)
    .where(eq(accessRoles.name, roleName));

  if (!role) {
    throw new Error(`Access role '${roleName}' not found in database`);
  }

  roleIdCache.set(roleName, role.id);
  return role.id;
}

interface GenerateTestOrganizationOptions {
  users?: {
    admin?: number;
    member?: number;
  };
  organizationName?: string;
  emailDomain?: string;
}

export interface GeneratedUser {
  authUserId: string;
  email: string;
  password: string;
  organizationUserId: string;
  profileId: string;
  role: 'Admin' | 'Member';
}

interface GenerateTestOrganizationOutput {
  organization: Organization;
  organizationProfile: typeof profiles.$inferSelect;
  adminUser: GeneratedUser;
  adminUsers: GeneratedUser[];
  memberUsers: GeneratedUser[];
  allUsers: GeneratedUser[];
}

/**
 * Test Organization Data Manager for Playwright e2e tests.
 *
 * Adapted from the vitest TestOrganizationDataManager to work with Playwright's
 * fixture lifecycle. Cleanup happens automatically after each test.
 */
export class E2ETestDataManager {
  private testId: string;
  private supabaseAdmin: SupabaseClient;

  // Track exact IDs created by this test instance for precise cleanup
  private createdProfileIds: string[] = [];
  private createdAuthUserIds: string[] = [];
  private createdOrganizationUserIds: string[] = [];

  constructor(testId: string) {
    this.testId = testId;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE',
      );
    }

    this.supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Generates a test organization with members of specified roles.
   */
  async createOrganization(
    opts?: GenerateTestOrganizationOptions,
  ): Promise<GenerateTestOrganizationOutput> {
    const {
      users: userCounts = { admin: 1, member: 0 },
      organizationName = 'Test Org',
      emailDomain = 'oneproject.org',
    } = opts || {};

    const orgNameWithTestId = `${organizationName}-${this.testId}`;

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

    this.createdProfileIds.push(orgProfile.id);

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

    const createUserWithRole = async (
      role: 'Admin' | 'Member',
    ): Promise<GeneratedUser> => {
      const { email } = this.generateUserWithRole(role, emailDomain);
      const password = `testpass-${randomUUID().slice(0, 8)}`;

      // Create auth user via Supabase Admin API
      const { data: authData, error: authError } =
        await this.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm for e2e tests
        });

      if (authError || !authData.user) {
        throw new Error(
          `Failed to create auth user for ${email}: ${authError?.message}`,
        );
      }

      const authUser = authData.user;
      this.createdAuthUserIds.push(authUser.id);

      // Get the user record that was created by the trigger
      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.authUserId, authUser.id));

      if (!userRecord) {
        throw new Error(`Failed to find user record for ${email}`);
      }

      if (userRecord.profileId) {
        this.createdProfileIds.push(userRecord.profileId);
      }

      const authUserEmail = authUser.email;
      if (!authUserEmail) {
        throw new Error(`Auth user ${authUser.id} has no email`);
      }

      // Create organization user
      const [orgUser] = await db
        .insert(organizationUsers)
        .values({
          organizationId: organization.id,
          authUserId: authUser.id,
          email: authUserEmail,
        })
        .returning();

      if (!orgUser) {
        throw new Error(`Failed to create organization user for ${email}`);
      }

      // Assign role to organization user (lookup by name for DB compatibility)
      const accessRoleId = await getRoleIdByName(role);
      await db.insert(organizationUserToAccessRoles).values({
        organizationUserId: orgUser.id,
        accessRoleId,
      });

      if (!userRecord.profileId) {
        throw new Error(`User record for ${email} is missing profileId`);
      }

      return {
        authUserId: authUser.id,
        email: authUserEmail,
        password,
        organizationUserId: orgUser.id,
        profileId: userRecord.profileId,
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
   * Generates an email/role pair for test users.
   */
  private generateUserWithRole(
    role: 'Admin' | 'Member',
    emailDomain = 'oneproject.org',
  ): { email: string; role: 'Admin' | 'Member' } {
    const randomSuffix = randomUUID().slice(0, 6);
    return {
      email: `e2e-${this.testId}-${role.toLowerCase()}-${randomSuffix}@${emailDomain}`,
      role,
    };
  }

  /**
   * Cleans up all test data created by this manager.
   * Called automatically by the Playwright fixture teardown.
   */
  async cleanup(): Promise<void> {
    // 1. Delete organization users
    if (this.createdOrganizationUserIds.length > 0) {
      await db
        .delete(organizationUsers)
        .where(inArray(organizationUsers.id, this.createdOrganizationUserIds));
    }

    // 2. Delete profiles (cascades to organizations -> organizationUsers)
    if (this.createdProfileIds.length > 0) {
      await db
        .delete(profiles)
        .where(inArray(profiles.id, this.createdProfileIds));
    }

    // 3. Delete auth users
    if (this.createdAuthUserIds.length > 0) {
      const deleteResults = await Promise.allSettled(
        this.createdAuthUserIds.map((userId) =>
          this.supabaseAdmin.auth.admin.deleteUser(userId),
        ),
      );

      const failures = deleteResults.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `Failed to delete ${failures.length}/${this.createdAuthUserIds.length} auth users`,
        );
      }
    }
  }
}

/**
 * Playwright fixture that provides test data management with automatic cleanup.
 */
export const test = base.extend<{
  testData: E2ETestDataManager;
}>({
  // eslint-disable-next-line no-empty-pattern
  testData: async ({}, use, testInfo) => {
    const testId = testInfo.testId.slice(0, 8);
    const manager = new E2ETestDataManager(testId);

    await use(manager);

    // Cleanup after the test
    await manager.cleanup();
  },
});

export { expect } from '@playwright/test';

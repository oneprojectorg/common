import { db } from '@op/db/client';
import {
  Organization,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';

import { createTestUser, supabaseTestAdminClient } from '../supabase-utils';

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
  emailDomain?: string;
}

interface GeneratedUser {
  authUserId: string;
  email: string;
  organizationUserId: string;
  profileId: string;
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
 * Test Organization Data Manager
 *
 * Provides a pattern for managing test data lifecycle with automatic cleanup.
 * All test data creation methods automatically register cleanup handlers using vitest's onTestFinished.
 *
 * @example
 * ```ts
 * it('should do something', async ({ task, onTestFinished }) => {
 *   const testData = new TestOrganizationDataManager(task.id, onTestFinished);
 *
 *   // Automatically registers cleanup
 *   const { organization, adminUser } = await testData.createOrganization({
 *     users: { admin: 1, member: 2 }
 *   });
 *
 *   // Test logic here...
 *   // Cleanup happens automatically after test finishes
 * });
 * ```
 */
export class TestOrganizationDataManager {
  private testId: string;
  private cleanupRegistered = false;
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;

  // Track exact IDs created by this test instance for precise cleanup
  private createdProfileIds: string[] = [];
  private createdAuthUserIds: string[] = [];

  constructor(
    testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.testId = testId;
    this.onTestFinishedCallback = onTestFinished;
  }

  /**
   * Generates a test organization with members of specified roles.
   * Automatically registers cleanup using onTestFinished.
   *
   * @param opts - Options for organization and user creation
   * @returns Organization with categorized users by role
   *
   * @example
   * ```ts
   * const testData = new TestOrganizationDataManager(task.id);
   * const { organization, adminUsers, memberUsers } = await testData.createOrganization({
   *   users: { admin: 2, member: 3 },
   *   organizationName: "Test Org"
   * });
   * ```
   */
  async createOrganization(
    opts?: GenerateTestOrganizationOptions,
  ): Promise<GenerateTestOrganizationOutput> {
    this.ensureCleanupRegistered();

    const {
      users: userCounts = { admin: 1, member: 0 },
      organizationName = 'Test Org',
      emailDomain = 'oneproject.org',
    } = opts || {};

    const orgNameWithTestId = `${organizationName}-${this.testId}`;

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

    // Track this profile ID for cleanup
    this.createdProfileIds.push(orgProfile.id);

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
      const { email } = this.generateUserWithRole(role, emailDomain);

      // Create auth user via Supabase Admin API
      // This triggers the database trigger which automatically creates:
      // - A row in the users table
      // - A profile for the user
      const authUser = await createTestUser(email).then((res) => res.user);

      if (!authUser || !authUser.email) {
        throw new Error(`Failed to create auth user for ${email}`);
      }

      // Track auth user ID for cleanup
      this.createdAuthUserIds.push(authUser.id);

      // Get the user record that was created by the trigger
      // The trigger creates both the user and profile automatically
      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.authUserId, authUser.id));

      if (!userRecord) {
        throw new Error(`Failed to find user record for ${email}`);
      }

      // Track the profile ID that was created by the trigger for cleanup
      if (userRecord.profileId) {
        this.createdProfileIds.push(userRecord.profileId);
      }

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

      // Get the role ID from predefined seed data constants
      const accessRoleId = role === 'Admin' ? ROLES.ADMIN.id : ROLES.MEMBER.id;

      // Assign role to organization user
      await db.insert(organizationUserToAccessRoles).values({
        organizationUserId: orgUser.id,
        accessRoleId,
      });

      if (!userRecord.profileId) {
        throw new Error(`User record for ${email} is missing profileId`);
      }

      return {
        authUserId: authUser.id,
        email: authUser.email!,
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
   * Generates an email/role pair for test users based on task ID and role.
   * Ensures consistent email generation across tests.
   * Supports multiple users per role by adding a random suffix.
   *
   * @param role - The role to assign to the user
   * @param emailDomain - The email domain to use (default: 'oneproject.org')
   * @returns An object with email and role properties
   *
   * @example
   * ```ts
   * const testData = new TestOrganizationDataManager(task.id);
   * const adminUser = testData.generateUserWithRole('Admin');
   * // Returns: { email: 'test-users-123-admin-a1b2c3@oneproject.org', role: 'Admin' }
   * const regularUser = testData.generateUserWithRole('Member', 'example.com');
   * // Returns: { email: 'test-users-123-member-a1b2c3@example.com', role: 'Member' }
   * ```
   */
  generateUserWithRole(
    role: 'Admin' | 'Member',
    emailDomain: string = 'oneproject.org',
  ): SeedUserInput {
    const randomSuffix = randomUUID().slice(0, 6);
    return {
      email: `${this.testId}-${role.toLowerCase()}-${randomSuffix}@${emailDomain}`,
      role,
    };
  }

  /**
   * Registers the cleanup handler for this test.
   * This is called automatically by test data creation methods.
   * Ensures cleanup is only registered once per test.
   *
   * Uses onTestFinished from test context to clean up after each concurrent test completes.
   */
  private ensureCleanupRegistered(): void {
    if (this.cleanupRegistered) {
      return;
    }

    // Register cleanup for this specific test using the callback from test context
    this.onTestFinishedCallback(async () => {
      await this.cleanup();
    });

    this.cleanupRegistered = true;
  }

  /**
   * Cleans up test data by deleting profiles and auth users created for this test.
   * Uses exact IDs tracked during creation to avoid race conditions with concurrent tests.
   * Relies on database cascade deletes to automatically clean up related records:
   * - Deleting profiles cascades to organizations, which cascades to organizationUsers and roles
   * - Deleting auth users cascades to users and organizationUsers tables
   *
   * This method is automatically called via onTestFinished when using test data creation methods.
   * You can also call it manually if needed, but this is not recommended.
   */
  async cleanup(): Promise<void> {
    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    // 1. Delete profiles by exact IDs (not pattern matching)
    // This will cascade to organizations -> organizationUsers -> organizationUserToAccessRoles
    if (this.createdProfileIds.length > 0) {
      await db
        .delete(profiles)
        .where(inArray(profiles.id, this.createdProfileIds));
    }

    // 2. Delete auth users by exact IDs (not pattern matching)
    // This will cascade to users and organizationUsers tables
    if (this.createdAuthUserIds.length > 0) {
      const deleteResults = await Promise.allSettled(
        this.createdAuthUserIds.map((userId) =>
          supabaseTestAdminClient.auth.admin.deleteUser(userId),
        ),
      );

      const failures = deleteResults.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn(
          `Failed to delete ${failures.length}/${this.createdAuthUserIds.length} auth users`,
        );
        // Don't throw - auth user deletion failures shouldn't break tests
      }
    }
  }
}

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
import { inArray } from 'drizzle-orm';
import { afterAll } from 'vitest';

import { createTestUser, supabaseTestAdminClient } from '../supabase-utils';

// Global cleanup queue for concurrent tests
// This collects all cleanup tasks and runs them after all tests finish
const cleanupQueue: Array<() => Promise<void>> = [];
let cleanupRegisteredGlobally = false;

function registerGlobalCleanup() {
  if (cleanupRegisteredGlobally) {
    return;
  }
  cleanupRegisteredGlobally = true;

  // Run all cleanup tasks after all tests finish
  afterAll(async () => {
    console.log(
      `Running cleanup for ${cleanupQueue.length} test data managers...`,
    );
    await Promise.allSettled(cleanupQueue.map((fn) => fn()));
    console.log('Cleanup complete.');
  });
}

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
 * Test Organization Data Manager
 *
 * Provides a pattern for managing test data lifecycle with automatic cleanup.
 * All test data creation methods automatically register cleanup handlers using vitest's onTestFinished.
 *
 * @example
 * ```ts
 * it('should do something', async ({ task }) => {
 *   const testData = new TestOrganizationDataManager(task.id);
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
  private createdProfileIds: string[] = [];
  private createdAuthUserIds: string[] = [];

  constructor(testId: string) {
    this.testId = testId;
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

    // Track for cleanup
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
      const { email } = this.generateUserWithRole(role);

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

      // Track for cleanup
      this.createdProfileIds.push(userProfile.id);
      this.createdAuthUserIds.push(authUser.id);

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

      // Get the role ID from predefined seed data constants
      const accessRoleId = role === 'Admin' ? ROLES.ADMIN.id : ROLES.MEMBER.id;

      // Assign role to organization user
      await db.insert(organizationUserToAccessRoles).values({
        organizationUserId: orgUser.id,
        accessRoleId,
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
   * @param role - The role to assign to the user
   * @returns An object with email and role properties
   *
   * @example
   * ```ts
   * const testData = new TestOrganizationDataManager(task.id);
   * const adminUser = testData.generateUserWithRole('Admin');
   * // Returns: { email: 'test-users-123-admin-a1b2c3@oneproject.org', role: 'Admin' }
   * ```
   */
  generateUserWithRole(role: 'Admin' | 'Member'): SeedUserInput {
    const randomSuffix = randomUUID().slice(0, 6);
    return {
      email: `test-users-${this.testId}-${role.toLowerCase()}-${randomSuffix}@oneproject.org`,
      role,
    };
  }

  /**
   * Registers the cleanup handler for this test.
   * This is called automatically by test data creation methods.
   * Ensures cleanup is only registered once per test.
   *
   * NOTE: For concurrent tests, cleanup is deferred to avoid race conditions.
   * Cleanup will happen after all tests in the suite finish.
   */
  private ensureCleanupRegistered(): void {
    if (this.cleanupRegistered) {
      return;
    }

    // Register global cleanup handler if not already done
    registerGlobalCleanup();

    // Add this instance's cleanup to the queue
    cleanupQueue.push(() => this.cleanup());

    this.cleanupRegistered = true;
  }

  /**
   * Cleans up test data by deleting profiles and auth users created for this test.
   * Relies on database cascade deletes to automatically clean up related records:
   * - Deleting profiles cascades to organizations, which cascades to organizationUsers and roles
   * - Deleting auth users cascades to users and organizationUsers tables
   *
   * This method is automatically called via onTestFinished when using test data creation methods.
   * You can also call it manually if needed, but this is not recommended.
   */
  async cleanup(): Promise<void> {
    if (!supabaseTestAdminClient) {
      console.warn('Supabase admin test client not initialized');
      return;
    }

    try {
      // 1. Delete profiles first by their specific IDs
      // This will cascade to organizations -> organizationUsers -> organizationUserToAccessRoles
      // We do this first to minimize race conditions with concurrent tests
      if (this.createdProfileIds.length > 0) {
        await db
          .delete(profiles)
          .where(inArray(profiles.id, this.createdProfileIds));
      }

      // 2. Delete auth users after profiles are deleted
      // This will cascade to users table
      // By this point, organizationUsers should already be deleted by cascade
      await Promise.allSettled(
        this.createdAuthUserIds.map((userId) =>
          supabaseTestAdminClient.auth.admin.deleteUser(userId),
        ),
      );
    } catch (error) {
      console.warn(
        `Failed to cleanup test data for test ${this.testId}:`,
        error,
      );
    }
  }
}

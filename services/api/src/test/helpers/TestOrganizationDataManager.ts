import { db } from '@op/db/client';
import { type Organization, organizationUsers, profiles } from '@op/db/schema';
import {
  type CreateOrganizationResult,
  type GeneratedUser,
  addUserToOrganization as addUserToOrgCore,
  createOrganization as createOrgCore,
  generateTestEmail,
} from '@op/test';
import { inArray } from 'drizzle-orm';

import { supabaseTestAdminClient } from '../supabase-utils';

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

interface GenerateTestOrganizationOutput {
  organization: Organization;
  organizationProfile: CreateOrganizationResult['organizationProfile'];
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
  private createdOrganizationUserIds: string[] = [];

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

    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    const result = await createOrgCore({
      testId: this.testId,
      supabaseAdmin: supabaseTestAdminClient,
      users: opts?.users,
      organizationName: opts?.organizationName,
      emailDomain: opts?.emailDomain,
    });

    // Track created IDs for cleanup
    this.createdProfileIds.push(...result.createdIds.profileIds);
    this.createdAuthUserIds.push(...result.createdIds.authUserIds);
    this.createdOrganizationUserIds.push(
      ...result.createdIds.organizationUserIds,
    );

    return {
      organization: result.organization,
      organizationProfile: result.organizationProfile,
      adminUser: result.adminUser,
      adminUsers: result.adminUsers,
      memberUsers: result.memberUsers,
      allUsers: result.allUsers,
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
    return {
      email: generateTestEmail(this.testId, role, emailDomain),
      role,
    };
  }

  /**
   * Adds an existing user to an organization as a member.
   * Useful for testing scenarios where a user needs to be a member of multiple organizations.
   * Automatically registers cleanup using onTestFinished.
   *
   * @param opts - Options for adding user to organization
   * @returns The created organization user record
   *
   * @example
   * ```ts
   * const { adminUser: userA } = await testData.createOrganization();
   * const { organization: orgB } = await testData.createOrganization();
   *
   * // Add userA as a member of orgB
   * await testData.addUserToOrganization({
   *   authUserId: userA.authUserId,
   *   organizationId: orgB.id,
   *   email: userA.email,
   * });
   * ```
   */
  async addUserToOrganization(opts: {
    authUserId: string;
    organizationId: string;
    email: string;
    role?: 'Admin' | 'Member';
  }): Promise<typeof organizationUsers.$inferSelect> {
    this.ensureCleanupRegistered();

    const result = await addUserToOrgCore(opts);

    this.createdOrganizationUserIds.push(result.organizationUserId);

    return result.orgUser;
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
   * Cleans up test data by deleting profiles, auth users, and organization users created for this test.
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

    // 1. Delete organization users added via addUserToOrganization
    // These need explicit cleanup as they may belong to organizations managed by other test instances
    if (this.createdOrganizationUserIds.length > 0) {
      await db
        .delete(organizationUsers)
        .where(inArray(organizationUsers.id, this.createdOrganizationUserIds));
    }

    // 2. Delete profiles by exact IDs (not pattern matching)
    // This will cascade to organizations -> organizationUsers -> organizationUserToAccessRoles
    if (this.createdProfileIds.length > 0) {
      await db
        .delete(profiles)
        .where(inArray(profiles.id, this.createdProfileIds));
    }

    // 3. Delete auth users by exact IDs (not pattern matching)
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

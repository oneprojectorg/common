import { db } from '@op/db/client';
import {
  allowList,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';

import { createTestUser, supabaseTestAdminClient } from '../supabase-utils';

interface GenerateTestProfileOptions {
  users?: {
    admin?: number;
    member?: number;
  };
  profileName?: string;
  emailDomain?: string;
}

interface GeneratedProfileUser {
  authUserId: string;
  email: string;
  profileUserId: string;
  userProfileId: string;
  role: 'Admin' | 'Member';
}

interface GenerateTestProfileOutput {
  profile: typeof profiles.$inferSelect;
  adminUser: GeneratedProfileUser;
  adminUsers: GeneratedProfileUser[];
  memberUsers: GeneratedProfileUser[];
  allUsers: GeneratedProfileUser[];
}

/**
 * Test Profile User Data Manager
 *
 * Provides a pattern for managing test data lifecycle with automatic cleanup.
 * Specifically for testing profile user endpoints (listUsers, addUser, updateUserRole, removeUser).
 * All test data creation methods automatically register cleanup handlers using vitest's onTestFinished.
 *
 * @example
 * ```ts
 * it('should do something', async ({ task, onTestFinished }) => {
 *   const testData = new TestProfileUserDataManager(task.id, onTestFinished);
 *
 *   // Automatically registers cleanup
 *   const { profile, adminUser, memberUsers } = await testData.createProfile({
 *     users: { admin: 1, member: 2 }
 *   });
 *
 *   // Test logic here...
 *   // Cleanup happens automatically after test finishes
 * });
 * ```
 */
export class TestProfileUserDataManager {
  private testId: string;
  private cleanupRegistered = false;
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;

  // Track exact IDs created by this test instance for precise cleanup
  private createdProfileIds: string[] = [];
  private createdAuthUserIds: string[] = [];
  private createdProfileUserIds: string[] = [];
  private createdAllowListEmails: string[] = [];

  constructor(
    testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.testId = testId;
    this.onTestFinishedCallback = onTestFinished;
  }

  /**
   * Creates a test profile with members of specified roles.
   * Automatically registers cleanup using onTestFinished.
   *
   * @param opts - Options for profile and user creation
   * @returns Profile with categorized users by role
   */
  async createProfile(
    opts?: GenerateTestProfileOptions,
  ): Promise<GenerateTestProfileOutput> {
    this.ensureCleanupRegistered();

    const {
      users: userCounts = { admin: 1, member: 0 },
      profileName = 'Test Profile',
      emailDomain = 'oneproject.org',
    } = opts || {};

    const profileNameWithTestId = `${profileName}-${this.testId}`;

    // 1. Create profile
    const [profile] = await db
      .insert(profiles)
      .values({
        name: profileNameWithTestId,
        slug: `${profileNameWithTestId.toLowerCase().replace(/\s+/g, '-')}-${randomUUID()}`,
      })
      .returning();

    if (!profile) {
      throw new Error('Failed to create profile');
    }

    // Track this profile ID for cleanup
    this.createdProfileIds.push(profile.id);

    const adminUsers: GeneratedProfileUser[] = [];
    const memberUsers: GeneratedProfileUser[] = [];

    // Helper function to create a user with a specific role
    const createUserWithRole = async (
      role: 'Admin' | 'Member',
    ): Promise<GeneratedProfileUser> => {
      const email = this.generateEmail(role, emailDomain);

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

      // Create profile user (add user to the profile)
      const [profileUser] = await db
        .insert(profileUsers)
        .values({
          authUserId: authUser.id,
          profileId: profile.id,
          email: authUser.email,
          name: `Test ${role} User`,
        })
        .returning();

      if (!profileUser) {
        throw new Error(`Failed to create profile user for ${email}`);
      }

      this.createdProfileUserIds.push(profileUser.id);

      // Get the role ID from predefined seed data constants
      const accessRoleId = role === 'Admin' ? ROLES.ADMIN.id : ROLES.MEMBER.id;

      // Assign role to profile user
      await db.insert(profileUserToAccessRoles).values({
        profileUserId: profileUser.id,
        accessRoleId,
      });

      if (!userRecord.profileId) {
        throw new Error(`User record for ${email} is missing profileId`);
      }

      return {
        authUserId: authUser.id,
        email: authUser.email!,
        profileUserId: profileUser.id,
        userProfileId: userRecord.profileId,
        role,
      };
    };

    // 2. Create admin users
    for (let i = 0; i < (userCounts.admin || 1); i++) {
      const user = await createUserWithRole('Admin');
      adminUsers.push(user);
    }

    // 3. Create member users
    for (let i = 0; i < (userCounts.member || 0); i++) {
      const user = await createUserWithRole('Member');
      memberUsers.push(user);
    }

    const [adminUser] = adminUsers;
    if (!adminUser) {
      throw new Error(
        'At least one admin user is required to create the profile',
      );
    }

    return {
      profile,
      adminUsers,
      adminUser,
      memberUsers,
      allUsers: [...adminUsers, ...memberUsers],
    };
  }

  /**
   * Creates an auth user without adding them to the profile.
   * Useful for testing addUser endpoint.
   */
  async createStandaloneUser(emailDomain: string = 'oneproject.org'): Promise<{
    authUserId: string;
    email: string;
    userProfileId: string;
  }> {
    this.ensureCleanupRegistered();

    const email = this.generateEmail('Standalone', emailDomain);

    const authUser = await createTestUser(email).then((res) => res.user);

    if (!authUser || !authUser.email) {
      throw new Error(`Failed to create auth user for ${email}`);
    }

    this.createdAuthUserIds.push(authUser.id);

    // Get the user record that was created by the trigger
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!userRecord || !userRecord.profileId) {
      throw new Error(`Failed to find user record for ${email}`);
    }

    this.createdProfileIds.push(userRecord.profileId);

    return {
      authUserId: authUser.id,
      email: authUser.email,
      userProfileId: userRecord.profileId,
    };
  }

  /**
   * Tracks an allowList entry for cleanup.
   * Call this when testing addUser with a new email that will be added to the allowList.
   */
  trackAllowListEmail(email: string): void {
    this.ensureCleanupRegistered();
    this.createdAllowListEmails.push(email.toLowerCase());
  }

  /**
   * Generates a unique email for test users.
   */
  private generateEmail(
    role: string,
    emailDomain: string = 'oneproject.org',
  ): string {
    const randomSuffix = randomUUID().slice(0, 6);
    return `${this.testId}-${role.toLowerCase()}-${randomSuffix}@${emailDomain}`;
  }

  /**
   * Registers the cleanup handler for this test.
   */
  private ensureCleanupRegistered(): void {
    if (this.cleanupRegistered) {
      return;
    }

    this.onTestFinishedCallback(async () => {
      await this.cleanup();
    });

    this.cleanupRegistered = true;
  }

  /**
   * Cleans up test data by deleting profiles, auth users, profile users, and allowList entries.
   * Uses exact IDs tracked during creation to avoid race conditions with concurrent tests.
   */
  async cleanup(): Promise<void> {
    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    // 1. Delete allowList entries by exact emails
    if (this.createdAllowListEmails.length > 0) {
      await db
        .delete(allowList)
        .where(inArray(allowList.email, this.createdAllowListEmails));
    }

    // 2. Delete profile users by exact IDs
    if (this.createdProfileUserIds.length > 0) {
      await db
        .delete(profileUsers)
        .where(inArray(profileUsers.id, this.createdProfileUserIds));
    }

    // 3. Delete profiles by exact IDs (cascades to profileUsers -> profileUserToAccessRoles)
    if (this.createdProfileIds.length > 0) {
      await db
        .delete(profiles)
        .where(inArray(profiles.id, this.createdProfileIds));
    }

    // 4. Delete auth users by exact IDs (cascades to users table)
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
      }
    }
  }
}

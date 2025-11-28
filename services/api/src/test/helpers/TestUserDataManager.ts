import { db } from '@op/db/client';
import { CommonUser, allowList, profiles, users } from '@op/db/schema';
import { eq, inArray } from 'drizzle-orm';

import { createTestUser, supabaseTestAdminClient } from '../supabase-utils';

interface CreatedUser {
  authUserId: string;
  email: string;
  userRecord: CommonUser;
}

/**
 * Test User Data Manager
 *
 * Manages standalone test users (not associated with an organization).
 * Automatically registers cleanup handlers using vitest's onTestFinished.
 *
 * @example
 * ```ts
 * it('should do something', async ({ task, onTestFinished }) => {
 *   const userManager = new TestUserDataManager(task.id, onTestFinished);
 *
 *   // Creates user and registers cleanup
 *   const user = await userManager.createUser('outsider@example.com');
 *
 *   // Test logic here...
 *   // Cleanup happens automatically after test finishes
 * });
 * ```
 */
export class TestUserDataManager {
  private testId: string;
  private cleanupRegistered = false;
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;

  private createdAuthUserIds: string[] = [];
  private createdProfileIds: string[] = [];
  private trackedAllowListIds: string[] = [];

  constructor(
    testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.testId = testId;
    this.onTestFinishedCallback = onTestFinished;
  }

  /**
   * Creates a standalone test user and tracks it for cleanup.
   *
   * @param email - Email for the user (will be prefixed with testId if not already)
   * @returns The created user details
   */
  async createUser(email: string): Promise<CreatedUser> {
    this.ensureCleanupRegistered();

    // Prefix email with testId if not already prefixed
    const fullEmail = email.includes(this.testId)
      ? email
      : `${this.testId}-${email}`;

    const authUser = await createTestUser(fullEmail).then((res) => res.user);

    if (!authUser || !authUser.email) {
      throw new Error(`Failed to create auth user for ${fullEmail}`);
    }

    this.createdAuthUserIds.push(authUser.id);

    // Get the user record created by the DB trigger
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!userRecord) {
      throw new Error(`Failed to find user record for ${fullEmail}`);
    }

    if (userRecord.profileId) {
      this.createdProfileIds.push(userRecord.profileId);
    }

    return {
      authUserId: authUser.id,
      email: fullEmail,
      userRecord,
    };
  }

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
   * Tracks an allowList entry ID for cleanup after the test finishes.
   *
   * @param entryId - The ID of the allowList entry to track
   *
   * @example
   * ```ts
   * const [allowListEntry] = await db.insert(allowList).values({...}).returning();
   * userManager.trackAllowListEntry(allowListEntry.id);
   * ```
   */
  trackAllowListEntry(entryId: string): void {
    this.ensureCleanupRegistered();
    this.trackedAllowListIds.push(entryId);
  }

  /**
   * Cleans up all users and allowList entries created/tracked by this manager.
   * Deletes allowList entries first, then profiles, then auth users.
   */
  async cleanup(): Promise<void> {
    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    // Delete tracked allowList entries
    if (this.trackedAllowListIds.length > 0) {
      await db
        .delete(allowList)
        .where(inArray(allowList.id, this.trackedAllowListIds));
    }

    // Delete profiles (this won't cascade to users, but cleans up the orphans)
    if (this.createdProfileIds.length > 0) {
      await db
        .delete(profiles)
        .where(inArray(profiles.id, this.createdProfileIds));
    }

    // Delete auth users (cascades to users table)
    if (this.createdAuthUserIds.length > 0) {
      await Promise.allSettled(
        this.createdAuthUserIds.map((userId) =>
          supabaseTestAdminClient.auth.admin.deleteUser(userId),
        ),
      );
    }
  }
}

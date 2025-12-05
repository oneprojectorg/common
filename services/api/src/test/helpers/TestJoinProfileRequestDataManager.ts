import { db } from '@op/db/client';
import {
  JoinProfileRequest,
  JoinProfileRequestStatus,
  joinProfileRequests,
} from '@op/db/schema';
import { inArray } from 'drizzle-orm';

/**
 * Test Join Profile Request Data Manager
 *
 * Provides a pattern for managing join profile request test data lifecycle with automatic cleanup.
 * All test data creation methods automatically register cleanup handlers using vitest's onTestFinished.
 *
 * @example
 * ```ts
 * it('should do something', async ({ task, onTestFinished }) => {
 *   const orgDataManager = new TestOrganizationDataManager(task.id, onTestFinished);
 *   const joinRequestManager = new TestJoinProfileRequestDataManager(task.id, onTestFinished);
 *
 *   const { adminUser: requester } = await orgDataManager.createOrganization();
 *   const { organizationProfile: targetProfile } = await orgDataManager.createOrganization();
 *
 *   // Create a join request - cleanup is automatically registered
 *   const { joinRequest } = await joinRequestManager.createJoinRequest({
 *     requestProfileId: requester.profileId,
 *     targetProfileId: targetProfile.id,
 *   });
 *
 *   // Test logic here...
 *   // Cleanup happens automatically after test finishes
 * });
 * ```
 */
export class TestJoinProfileRequestDataManager {
  private cleanupRegistered = false;
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;

  // Track exact IDs created by this test instance for precise cleanup
  private createdJoinRequestIds: string[] = [];

  constructor(
    /* not needed in this implementation, but kept for consistency */
    _testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.onTestFinishedCallback = onTestFinished;
  }

  /**
   * Creates a join profile request between two profiles.
   * Automatically registers cleanup using onTestFinished.
   */
  async createJoinRequest(opts: {
    requestProfileId: string;
    targetProfileId: string;
    status?: JoinProfileRequestStatus;
  }): Promise<{
    joinRequest: JoinProfileRequest;
  }> {
    this.ensureCleanupRegistered();

    const { requestProfileId, targetProfileId, status } = opts;

    const [joinRequest] = await db
      .insert(joinProfileRequests)
      .values({
        requestProfileId,
        targetProfileId,
        status: status ?? JoinProfileRequestStatus.PENDING,
      })
      .returning();

    if (!joinRequest) {
      throw new Error('Failed to create join profile request');
    }

    this.createdJoinRequestIds.push(joinRequest.id);

    return { joinRequest };
  }

  /**
   * Tracks a join request ID for cleanup.
   * Use this when the join request was created by the API rather than by this manager.
   *
   * @param joinRequestId - The ID of the join request to track
   *
   * @example
   * ```ts
   * const result = await caller.createJoinProfileRequest({
   *   requestProfileId: requester.profileId,
   *   targetProfileId: targetProfile.id,
   * });
   * joinRequestManager.trackJoinRequest(result.id);
   * ```
   */
  trackJoinRequest(joinRequestId: string): void {
    this.ensureCleanupRegistered();
    this.createdJoinRequestIds.push(joinRequestId);
  }

  /**
   * Registers the cleanup handler for this test.
   * This is called automatically by test data creation methods.
   * Ensures cleanup is only registered once per test.
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
   * Cleans up test data by deleting join requests created for this test.
   * Uses exact IDs tracked during creation to avoid race conditions with concurrent tests.
   *
   * This method is automatically called via onTestFinished when using test data creation methods.
   */
  async cleanup(): Promise<void> {
    if (this.createdJoinRequestIds.length > 0) {
      await db
        .delete(joinProfileRequests)
        .where(inArray(joinProfileRequests.id, this.createdJoinRequestIds));
    }
  }
}

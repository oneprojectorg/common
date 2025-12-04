import { db } from '@op/db/client';
import {
  JoinProfileRequest,
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizationUsers,
} from '@op/db/schema';
import { inArray } from 'drizzle-orm';

interface CreateJoinRequestInput {
  requestProfileId: string;
  targetProfileId: string;
  status?: JoinProfileRequestStatus;
}

interface CreateJoinRequestOutput {
  joinRequest: JoinProfileRequest;
}

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
  private testId: string;
  private cleanupRegistered = false;
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;

  // Track exact IDs created by this test instance for precise cleanup
  private createdJoinRequestIds: string[] = [];
  private createdOrganizationUserIds: string[] = [];

  constructor(
    testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.testId = testId;
    this.onTestFinishedCallback = onTestFinished;
  }

  /**
   * Creates a join profile request between two profiles.
   * Automatically registers cleanup using onTestFinished.
   *
   * @param opts - Options for join request creation
   * @returns The created join request
   *
   * @example
   * ```ts
   * const { joinRequest } = await joinRequestManager.createJoinRequest({
   *   requestProfileId: requester.profileId,
   *   targetProfileId: targetProfile.id,
   *   status: JoinProfileRequestStatus.PENDING,
   * });
   * ```
   */
  async createJoinRequest(
    opts: CreateJoinRequestInput,
  ): Promise<CreateJoinRequestOutput> {
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
   * Creates multiple join profile requests for a single target profile.
   * Useful for testing list operations.
   *
   * @param opts - Options for bulk creation
   * @returns Array of created join requests
   *
   * @example
   * ```ts
   * const requests = await joinRequestManager.createJoinRequestsForTarget({
   *   targetProfileId: targetProfile.id,
   *   requesters: [
   *     { profileId: requester1.profileId, status: JoinProfileRequestStatus.PENDING },
   *     { profileId: requester2.profileId, status: JoinProfileRequestStatus.APPROVED },
   *   ],
   * });
   * ```
   */
  async createJoinRequestsForTarget(opts: {
    targetProfileId: string;
    requesters: Array<{
      profileId: string;
      status?: JoinProfileRequestStatus;
    }>;
  }): Promise<JoinProfileRequest[]> {
    this.ensureCleanupRegistered();

    const { targetProfileId, requesters } = opts;

    const results: JoinProfileRequest[] = [];

    for (const requester of requesters) {
      const { joinRequest } = await this.createJoinRequest({
        requestProfileId: requester.profileId,
        targetProfileId,
        status: requester.status,
      });
      results.push(joinRequest);
    }

    return results;
  }

  /**
   * Creates an organization user membership.
   * Useful for testing scenarios where a user is already a member.
   * Automatically registers cleanup.
   *
   * @param opts - Options for organization user creation
   * @returns The created organization user record
   */
  async createOrganizationUserMembership(opts: {
    authUserId: string;
    organizationId: string;
    email: string;
    name?: string;
  }): Promise<typeof organizationUsers.$inferSelect> {
    this.ensureCleanupRegistered();

    const [orgUser] = await db
      .insert(organizationUsers)
      .values({
        authUserId: opts.authUserId,
        organizationId: opts.organizationId,
        email: opts.email,
        name: opts.name,
      })
      .returning();

    if (!orgUser) {
      throw new Error('Failed to create organization user');
    }

    this.createdOrganizationUserIds.push(orgUser.id);

    return orgUser;
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
   * Tracks an organization user ID for cleanup.
   * Use this when the organization user was created externally.
   *
   * @param organizationUserId - The ID of the organization user to track
   */
  trackOrganizationUser(organizationUserId: string): void {
    this.ensureCleanupRegistered();
    this.createdOrganizationUserIds.push(organizationUserId);
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
   * Cleans up test data by deleting join requests and organization users created for this test.
   * Uses exact IDs tracked during creation to avoid race conditions with concurrent tests.
   *
   * This method is automatically called via onTestFinished when using test data creation methods.
   */
  async cleanup(): Promise<void> {
    // 1. Delete join requests by exact IDs
    if (this.createdJoinRequestIds.length > 0) {
      await db
        .delete(joinProfileRequests)
        .where(inArray(joinProfileRequests.id, this.createdJoinRequestIds));
    }

    // 2. Delete organization users by exact IDs
    if (this.createdOrganizationUserIds.length > 0) {
      await db
        .delete(organizationUsers)
        .where(inArray(organizationUsers.id, this.createdOrganizationUserIds));
    }
  }
}

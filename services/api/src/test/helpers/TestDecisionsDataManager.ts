import { createInstance, createOrganization, createProcess } from '@op/common';
import { db } from '@op/db/client';
import {
  DecisionProcess,
  ProcessInstance,
  ProcessInstanceStatus,
  processInstances,
  profiles,
  profileUsers,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';

import { createTestUser, supabaseTestAdminClient } from '../supabase-utils';

interface CreateDecisionSetupOptions {
  organizationName?: string;
  processName?: string;
  processDescription?: string;
  instanceCount?: number;
  grantAccess?: boolean;
}

interface CreatedInstance {
  instance: ProcessInstance;
  profileId: string;
}

interface DecisionSetupOutput {
  user: User;
  userEmail: string;
  organization: any;
  process: DecisionProcess;
  instances: CreatedInstance[];
}

/**
 * Test Decisions Data Manager
 *
 * Provides a pattern for managing decision process test data lifecycle with automatic cleanup.
 * All test data creation methods automatically register cleanup handlers using vitest's onTestFinished.
 *
 * @example
 * ```ts
 * it('should do something', async ({ task, onTestFinished }) => {
 *   const testData = new TestDecisionsDataManager(task.id, onTestFinished);
 *
 *   // Automatically registers cleanup
 *   const { user, organization, process, instances } = await testData.createDecisionSetup({
 *     instanceCount: 3,
 *     grantAccess: true
 *   });
 *
 *   // Test logic here...
 *   // Cleanup happens automatically after test finishes
 * });
 * ```
 */
export class TestDecisionsDataManager {
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
   * Creates a complete decision process setup including:
   * - A test user
   * - An organization
   * - A decision process
   * - Optional process instances with profile access
   *
   * @param opts - Options for setup creation
   * @returns Complete decision setup with user, organization, process, and instances
   */
  async createDecisionSetup(
    opts?: CreateDecisionSetupOptions,
  ): Promise<DecisionSetupOutput> {
    this.ensureCleanupRegistered();

    const {
      organizationName = 'Test Organization',
      processName = 'Test Process',
      processDescription = 'A test decision process',
      instanceCount = 0,
      grantAccess = false,
    } = opts || {};

    // 1. Create test user
    const userEmail = this.generateTestEmail();
    const authUser = await createTestUser(userEmail).then((res) => res.user);

    if (!authUser || !authUser.email) {
      throw new Error(`Failed to create auth user for ${userEmail}`);
    }

    this.createdAuthUserIds.push(authUser.id);

    // Get the user record that was created by the trigger
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!userRecord) {
      throw new Error(`Failed to find user record for ${userEmail}`);
    }

    // Track the profile ID that was created by the trigger for cleanup
    if (userRecord.profileId) {
      this.createdProfileIds.push(userRecord.profileId);
    }

    const user: User = {
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
      app_metadata: authUser.app_metadata,
      aud: authUser.aud,
      created_at: authUser.created_at,
    };

    // 2. Create organization
    const organization = await createOrganization({
      data: {
        name: this.generateUniqueName(organizationName),
        website: 'https://test.com',
        email: 'contact@test.com',
        orgType: 'nonprofit',
        bio: 'Organization for testing',
        mission: 'To test decision profiles',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user,
    });

    this.createdProfileIds.push(organization.profileId);

    // 3. Create decision process
    const process = await createProcess({
      data: {
        name: this.generateUniqueName(processName),
        description: processDescription,
        processSchema: {
          name: processName,
          states: [
            {
              id: 'initial',
              name: 'Initial',
              type: 'initial',
            },
            {
              id: 'final',
              name: 'Final',
              type: 'final',
            },
          ],
          transitions: [
            {
              id: 'start',
              name: 'Start',
              from: 'initial',
              to: 'final',
            },
          ],
          initialState: 'initial',
          decisionDefinition: {},
          proposalTemplate: {},
        },
      },
      user,
      ownerProfileId: organization.profileId,
    });

    // 4. Create instances if requested
    const instances: CreatedInstance[] = [];
    for (let i = 0; i < instanceCount; i++) {
      const instance = await this.createInstanceForProcess({
        process,
        user,
        name: `Instance ${i + 1}`,
        budget: 50000 * (i + 1),
      });

      instances.push(instance);

      if (grantAccess) {
        await this.grantProfileAccess(instance.profileId, authUser.id, userEmail);
      }
    }

    return {
      user,
      userEmail,
      organization,
      process,
      instances,
    };
  }

  /**
   * Creates a process instance for an existing process
   */
  async createInstanceForProcess({
    process,
    user,
    name,
    budget = 50000,
    status,
  }: {
    process: DecisionProcess;
    user: User;
    name: string;
    budget?: number;
    status?: ProcessInstanceStatus;
  }): Promise<CreatedInstance> {
    this.ensureCleanupRegistered();

    const instance = await createInstance({
      data: {
        processId: process.id,
        name: this.generateUniqueName(name),
        description: `Test instance ${name}`,
        instanceData: {
          budget,
          hideBudget: false,
          currentStateId: 'initial',
          phases: [
            {
              stateId: 'initial',
              plannedStartDate: new Date().toISOString(),
              plannedEndDate: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
            {
              stateId: 'final',
              plannedStartDate: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              plannedEndDate: new Date(
                Date.now() + 14 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          ],
        },
      },
      user,
    });

    this.createdProfileIds.push(instance.profileId);

    // Update status if provided
    if (status) {
      await db
        .update(processInstances)
        .set({ status })
        .where(eq(processInstances.id, instance.id));
    }

    return {
      instance,
      profileId: instance.profileId,
    };
  }

  /**
   * Grants profile access to a user
   */
  async grantProfileAccess(
    profileId: string,
    authUserId: string,
    email: string,
  ): Promise<void> {
    await db.insert(profileUsers).values({
      profileId,
      authUserId,
      email,
    });
  }

  /**
   * Generates a unique test email for this test
   */
  private generateTestEmail(): string {
    const randomSuffix = randomUUID();
    return `${this.testId}-${randomSuffix}@oneproject.org`;
  }

  /**
   * Generates a unique name with both test ID and full UUID for maximum uniqueness
   */
  private generateUniqueName(baseName: string): string {
    return `${baseName}-${this.testId}-${randomUUID()}`;
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
   * Cleans up test data by deleting profiles and auth users created for this test.
   * Uses exact IDs tracked during creation to avoid race conditions with concurrent tests.
   * Relies on database cascade deletes to automatically clean up related records.
   */
  async cleanup(): Promise<void> {
    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    // 1. Delete profiles by exact IDs
    // This will cascade to organizations, processes, instances, etc.
    if (this.createdProfileIds.length > 0) {
      await db
        .delete(profiles)
        .where(inArray(profiles.id, this.createdProfileIds));
    }

    // 2. Delete auth users by exact IDs
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

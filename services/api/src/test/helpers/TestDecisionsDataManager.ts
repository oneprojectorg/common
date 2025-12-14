import { db } from '@op/db/client';
import {
  DecisionProcess,
  ProcessInstance,
  ProcessStatus,
  organizationUserToAccessRoles,
  organizationUsers,
  processInstances,
  profileUsers,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import type { User } from '@op/supabase/lib';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';

import type {
  decisionProcessEncoder,
  processInstanceEncoder,
} from '../../encoders/decision';
import { appRouter } from '../../routers';
import { createCallerFactory } from '../../trpcFactory';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../supabase-utils';

const createCaller = createCallerFactory(appRouter);

interface CreateDecisionSetupOptions {
  organizationName?: string;
  processName?: string;
  processDescription?: string;
  instanceCount?: number;
  grantAccess?: boolean;
}

type EncodedProcessInstance = z.infer<typeof processInstanceEncoder>;

interface CreatedInstance {
  instance: EncodedProcessInstance;
  profileId: string;
  slug: string;
}

type EncodedDecisionProcess = z.infer<typeof decisionProcessEncoder>;

interface DecisionSetupOutput {
  user: User;
  userEmail: string;
  organization: Record<string, unknown> & { id: string; profileId: string };
  process: EncodedDecisionProcess;
  instances: CreatedInstance[];
}

interface MemberUserOutput {
  user: User;
  email: string;
  authUserId: string;
  profileId: string;
}

/**
 * Test Decisions Data Manager
 *
 * Provides a pattern for managing decision process test data lifecycle with automatic cleanup.
 * All test data creation methods automatically register cleanup handlers using vitest's onTestFinished.
 *
 * Uses tRPC callers to test through the router boundary for better integration coverage.
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
   * Creates an authenticated tRPC caller for a user by email
   */
  private async createAuthenticatedCaller(email: string) {
    const { session } = await createIsolatedSession(email);
    return createCaller(await createTestContextWithSession(session));
  }

  /**
   * Creates a complete decision process setup including:
   * - A test user
   * - An organization
   * - A decision process
   * - Optional process instances with profile access
   *
   * All operations go through the tRPC router boundary.
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

    // Create authenticated caller for this user
    const caller = await this.createAuthenticatedCaller(userEmail);

    // 2. Create organization via router
    const organization = await caller.organization.create({
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
    });

    // Get profileId from the profile relation (available in the encoder response)
    const orgProfileId = organization.profile?.id;
    if (!orgProfileId) {
      throw new Error('Organization profile ID not found in response');
    }
    this.createdProfileIds.push(orgProfileId);

    // 3. Create decision process via router
    const process = await caller.decision.createProcess({
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
    });

    // 4. Create instances if requested
    const instances: CreatedInstance[] = [];
    for (let i = 0; i < instanceCount; i++) {
      const instance = await this.createInstanceForProcess({
        caller,
        processId: process.id,
        name: `Instance ${i + 1}`,
        budget: 50000 * (i + 1),
      });

      instances.push(instance);

      if (grantAccess) {
        await this.grantProfileAccess(
          instance.profileId,
          authUser.id,
          userEmail,
        );
      }
    }

    return {
      user,
      userEmail,
      // Add profileId as a convenience property for tests
      organization: { ...organization, profileId: orgProfileId },
      process,
      instances,
    };
  }

  /**
   * Creates a process instance for an existing process via router.
   * Accepts either a caller directly OR a process+user to create the caller internally.
   */
  async createInstanceForProcess(
    this: TestDecisionsDataManager,
    {
      caller,
      processId,
      process,
      user,
      name,
      budget = 50000,
      status,
    }: {
      caller?: Awaited<
        ReturnType<TestDecisionsDataManager['createAuthenticatedCaller']>
      >;
      processId?: string;
      process?: EncodedDecisionProcess;
      user?: User;
      name: string;
      budget?: number;
      status?: ProcessStatus;
    },
  ): Promise<CreatedInstance> {
    this.ensureCleanupRegistered();

    // Resolve caller - either use provided caller or create one from user
    let resolvedCaller = caller;
    if (!resolvedCaller && user?.email) {
      resolvedCaller = await this.createAuthenticatedCaller(user.email);
    }
    if (!resolvedCaller) {
      throw new Error('Either caller or user with email must be provided');
    }

    // Resolve processId - either use provided processId or get from process object
    const resolvedProcessId = processId ?? process?.id;
    if (!resolvedProcessId) {
      throw new Error('Either processId or process must be provided');
    }

    const instance = await resolvedCaller.decision.createInstance({
      processId: resolvedProcessId,
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
    });

    // Query the database for the profileId (not exposed in the API response)
    const [instanceRecord] = await db
      .select({ profileId: processInstances.profileId })
      .from(processInstances)
      .where(eq(processInstances.id, instance.id));

    const profileId = instanceRecord?.profileId;
    if (!profileId) {
      throw new Error(`Could not find profileId for instance ${instance.id}`);
    }

    this.createdProfileIds.push(profileId);

    // Update status if provided (direct DB update since there's no router for this)
    if (status) {
      await db
        .update(processInstances)
        .set({ status })
        .where(eq(processInstances.id, instance.id));
    }

    // Fetch the profile to get the slug (use profileId we queried earlier, not instance.profileId)
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
    });

    if (!profile) {
      throw new Error(`Profile not found for instance: ${instance.id}`);
    }

    return {
      instance,
      profileId,
      slug: profile.slug,
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
   * Creates a member user (non-admin) for an organization with proper setup.
   * This creates:
   * - An auth user via Supabase
   * - Waits for trigger to create user record and profile
   * - Adds them to the organization with Member role
   * - Optionally grants access to instance profiles
   */
  async createMemberUser({
    organization,
    instanceProfileIds = [],
  }: {
    organization: { id: string };
    instanceProfileIds?: string[];
  }): Promise<MemberUserOutput> {
    this.ensureCleanupRegistered();

    const email = this.generateTestEmail();

    // Create auth user via Supabase - triggers DB user and profile creation
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

    if (!userRecord) {
      throw new Error(`Failed to find user record for ${email}`);
    }

    // Track the profile ID that was created by the trigger for cleanup
    if (userRecord.profileId) {
      this.createdProfileIds.push(userRecord.profileId);
    }

    // Add user to organization
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

    // Assign Member role to organization user
    await db.insert(organizationUserToAccessRoles).values({
      organizationUserId: orgUser.id,
      accessRoleId: ROLES.MEMBER.id,
    });

    // Grant access to instance profiles if provided
    for (const profileId of instanceProfileIds) {
      await this.grantProfileAccess(profileId, authUser.id, email);
    }

    const user: User = {
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
      app_metadata: authUser.app_metadata,
      aud: authUser.aud,
      created_at: authUser.created_at,
    };

    return {
      user,
      email,
      authUserId: authUser.id,
      profileId: userRecord.profileId!,
    };
  }

  /**
   * Creates a proposal via the tRPC router and tracks its profile for cleanup.
   */
  async createProposal({
    callerEmail,
    processInstanceId,
    proposalData,
  }: {
    callerEmail: string;
    processInstanceId: string;
    proposalData: { title: string; description: string };
  }) {
    this.ensureCleanupRegistered();

    const caller = await this.createAuthenticatedCaller(callerEmail);
    const proposal = await caller.decision.createProposal({
      processInstanceId,
      proposalData,
    });

    // Track the proposal's profile for cleanup
    if (proposal.profileId) {
      this.createdProfileIds.push(proposal.profileId);
    }

    return proposal;
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
    // Filter out any undefined/null values that might have been accidentally added
    const validProfileIds = this.createdProfileIds.filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    if (validProfileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, validProfileIds));
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

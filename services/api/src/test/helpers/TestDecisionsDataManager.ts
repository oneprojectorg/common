import {
  createDecisionInstance,
  createInstanceDataFromTemplate,
  createOrganization as createOrganizationService,
  createProposal as createProposalService,
  getTemplate,
  joinOrganization,
} from '@op/common';
import { db } from '@op/db/client';
import type { ProcessStatus } from '@op/db/schema';
import {
  ProposalStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profiles,
  proposals,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import type { User } from '@op/supabase/lib';
import { grantDecisionProfileAccess, testMinimalSchema } from '@op/test';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';

import type {
  decisionProcessWithSchemaEncoder,
  decisionSchemaDefinitionEncoder,
  processInstanceWithSchemaEncoder,
} from '../../encoders/decision';
import { processInstanceWithSchemaEncoder as processInstanceEncoder } from '../../encoders/decision';
import { createTestUser, supabaseTestAdminClient } from '../supabase-utils';

type DecisionSchemaDefinition = z.infer<typeof decisionSchemaDefinitionEncoder>;

interface CreateDecisionSetupOptions {
  organizationName?: string;
  processName?: string;
  processDescription?: string;
  instanceCount?: number;
  grantAccess?: boolean;
  /** Status to assign to created instances. Defaults to DRAFT. */
  status?: ProcessStatus;
  /** JSON Schema to validate proposal data against on submit/update */
  proposalTemplate?: Record<string, unknown>;
  /** Custom process schema definition. Defaults to testMinimalSchema. */
  processSchema?: DecisionSchemaDefinition;
}

type EncodedProcessInstance = z.infer<typeof processInstanceWithSchemaEncoder>;

interface CreatedInstance {
  instance: EncodedProcessInstance;
  profileId: string;
  slug: string;
}

type EncodedDecisionProcess = z.infer<typeof decisionProcessWithSchemaEncoder>;

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
 * Uses service-layer calls from @op/common to set up fixtures without tRPC/session overhead.
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
   * Resolves a Supabase auth user from an email without creating a session.
   */
  private async getAuthUserByEmail(email: string): Promise<User> {
    const [userRecord] = await db
      .select({ authUserId: users.authUserId })
      .from(users)
      .where(eq(users.email, email));

    if (!userRecord?.authUserId) {
      throw new Error(`Failed to find auth user for ${email}`);
    }

    if (!supabaseTestAdminClient) {
      throw new Error('Supabase admin test client not initialized');
    }

    const { data, error } =
      await supabaseTestAdminClient.auth.admin.getUserById(
        userRecord.authUserId,
      );

    if (error || !data.user) {
      throw new Error(`Failed to load auth user for ${email}`);
    }

    return data.user;
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
      status,
      proposalTemplate,
      processSchema,
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
    if (!userRecord.profileId) {
      throw new Error(`User record missing profileId for ${userEmail}`);
    }
    this.createdProfileIds.push(userRecord.profileId);

    const user: User = {
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata,
      app_metadata: authUser.app_metadata,
      aud: authUser.aud,
      created_at: authUser.created_at,
    };

    // 2. Create organization via service
    const organization = await createOrganizationService({
      user,
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
    });

    // Get profileId from the created profile
    const orgProfileId = organization.profile?.id;
    if (!orgProfileId) {
      throw new Error('Organization profile ID not found in response');
    }
    this.createdProfileIds.push(orgProfileId);

    // 3. Create decision process via direct DB insert with the new schema format
    const newProcessSchema = {
      ...(processSchema ?? testMinimalSchema),
      name: processName,
      ...(proposalTemplate ? { proposalTemplate } : {}),
    };

    const [processRecord] = await db
      .insert(decisionProcesses)
      .values({
        name: this.generateUniqueName(processName),
        description: processDescription,
        processSchema: newProcessSchema,
        createdByProfileId: userRecord.profileId,
      })
      .returning();

    if (!processRecord) {
      throw new Error('Failed to create decision process');
    }

    // Map to the expected encoder format
    const process: EncodedDecisionProcess = {
      id: processRecord.id,
      name: processRecord.name,
      description: processRecord.description,
      createdAt: processRecord.createdAt,
      updatedAt: processRecord.updatedAt,
      processSchema: processRecord.processSchema as DecisionSchemaDefinition,
    };

    // 4. Create instances if requested
    const instances: CreatedInstance[] = [];
    for (let i = 0; i < instanceCount; i++) {
      const instance = await this.createInstanceForProcess({
        processId: process.id,
        user,
        name: `Instance ${i + 1}`,
        budget: 50000 * (i + 1),
        status,
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
   * Creates a process instance for an existing process using the decision service.
   */
  async createInstanceForProcess(
    this: TestDecisionsDataManager,
    {
      processId,
      process,
      user,
      name,
      budget = 50000,
      status,
    }: {
      processId?: string;
      process?: EncodedDecisionProcess;
      user?: User;
      name: string;
      budget?: number;
      status?: ProcessStatus;
    },
  ): Promise<CreatedInstance> {
    this.ensureCleanupRegistered();

    if (!user?.email) {
      throw new Error('User with email must be provided');
    }

    const resolvedProcessId = processId ?? process?.id;
    if (!resolvedProcessId) {
      throw new Error('Either processId or process must be provided');
    }

    const [dbUser] = await db
      .select({
        currentProfileId: users.currentProfileId,
        profileId: users.profileId,
      })
      .from(users)
      .where(eq(users.authUserId, user.id));

    const ownerProfileId = dbUser?.currentProfileId ?? dbUser?.profileId;
    if (!ownerProfileId) {
      throw new Error(`Failed to resolve owner profile for ${user.email}`);
    }

    const template = await getTemplate(resolvedProcessId);
    const instanceData = createInstanceDataFromTemplate({
      template,
      phaseOverrides: [
        {
          phaseId: 'initial',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          phaseId: 'final',
          startDate: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          endDate: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ],
    });

    const profile = await createDecisionInstance({
      processId: resolvedProcessId,
      instanceData,
      name: this.generateUniqueName(name),
      description: `Test instance ${name}`,
      ownerProfileId,
      stewardProfileId: ownerProfileId,
      creatorAuthUserId: user.id,
      creatorEmail: user.email,
      status,
    });

    const profileId = profile.id;
    const processInstance = profile.processInstance;
    if (!processInstance) {
      throw new Error('Failed to load created process instance');
    }

    this.createdProfileIds.push(profileId);

    // Update budget if needed (instanceData may not include budget from template)
    if (budget) {
      const instanceRecord = await db._query.processInstances.findFirst({
        where: eq(processInstances.id, processInstance.id),
      });
      if (instanceRecord) {
        const instanceData = instanceRecord.instanceData as Record<
          string,
          unknown
        >;
        await db
          .update(processInstances)
          .set({
            instanceData: {
              ...instanceData,
              budget,
              hideBudget: false,
            },
          })
          .where(eq(processInstances.id, processInstance.id));
      }
    }

    return {
      instance: processInstanceEncoder.parse(processInstance),
      profileId,
      slug: profile.slug,
    };
  }

  /**
   * Grants profile access to a user
   * @param profileId - The profile to grant access to
   * @param authUserId - The auth user ID
   * @param email - The user's email
   * @param isAdmin - If true, assigns Admin role; if false, assigns Member role
   */
  async grantProfileAccess(
    profileId: string,
    authUserId: string,
    email: string,
    isAdmin = true,
  ): Promise<void> {
    await grantDecisionProfileAccess({
      profileId,
      authUserId,
      email,
      isAdmin,
    });
  }

  /**
   * Assigns an access role to a user on a specific decision profile.
   */
  async assignRole(
    authUserId: string,
    profileId: string,
    roleId: string,
  ): Promise<void> {
    const profileUser = await db.query.profileUsers.findFirst({
      where: {
        authUserId,
        profileId,
      },
    });

    if (!profileUser) {
      throw new Error(
        `No profileUser found for authUserId=${authUserId} on profile=${profileId}`,
      );
    }

    await db.insert(profileUserToAccessRoles).values({
      profileUserId: profileUser.id,
      accessRoleId: roleId,
    });
  }

  /**
   * Tracks a profile ID for cleanup. Use this when creating profiles
   * outside of the standard TestDecisionsDataManager methods.
   */
  trackProfileForCleanup(profileId: string): void {
    this.ensureCleanupRegistered();
    this.createdProfileIds.push(profileId);
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
    roleIds = {},
  }: {
    organization: { id: string };
    instanceProfileIds?: string[];
    /** Map of profileId → roleId to assign after granting profile access. */
    roleIds?: Record<string, string>;
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

    const orgRecord = await db.query.organizations.findFirst({
      where: { id: organization.id },
    });

    if (!orgRecord) {
      throw new Error(`Failed to find organization ${organization.id}`);
    }

    const orgUser = await joinOrganization({
      user: userRecord,
      organization: orgRecord,
      roleId: ROLES.MEMBER.id,
    });

    if (!orgUser) {
      throw new Error(`Failed to create organization user for ${email}`);
    }

    // Grant access to instance profiles if provided (member role, not admin)
    for (const profileId of instanceProfileIds) {
      await this.grantProfileAccess(profileId, authUser.id, email, false);
    }

    // Assign additional roles on specific profiles
    for (const [profileId, roleId] of Object.entries(roleIds)) {
      await this.assignRole(authUser.id, profileId, roleId);
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
   * Creates a proposal via the decision service and tracks its profile for cleanup.
   * If `description` is provided, removes `collaborationDocId` to simulate legacy proposals.
   */
  async createProposal({
    userEmail,
    processInstanceId,
    proposalData,
    status,
  }: {
    userEmail: string;
    processInstanceId: string;
    proposalData: {
      title: string;
      description?: string;
      collaborationDocId?: string;
    };
    status?: ProposalStatus;
  }) {
    this.ensureCleanupRegistered();

    const user = await this.getAuthUserByEmail(userEmail);
    const proposal = await createProposalService({
      data: {
        processInstanceId,
        proposalData,
      },
      user,
    });

    // Track the proposal's profile for cleanup
    if (proposal.profileId) {
      this.createdProfileIds.push(proposal.profileId);
    }

    const nonDefaultStatus =
      status && status !== ProposalStatus.DRAFT ? status : undefined;

    // Simulate legacy proposal by removing collaborationDocId when description is provided
    const legacyProposalData = proposalData.description
      ? (() => {
          const { collaborationDocId: _, ...rest } =
            proposal.proposalData as Record<string, unknown>;
          return { ...rest, ...proposalData };
        })()
      : undefined;

    if (nonDefaultStatus || legacyProposalData) {
      await db
        .update(proposals)
        .set({
          ...(nonDefaultStatus ? { status: nonDefaultStatus } : {}),
          ...(legacyProposalData ? { proposalData: legacyProposalData } : {}),
        })
        .where(eq(proposals.id, proposal.id));
      return {
        ...proposal,
        ...(nonDefaultStatus ? { status: nonDefaultStatus } : {}),
        ...(legacyProposalData ? { proposalData: legacyProposalData } : {}),
      };
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
   * Generates a unique name with UUID first to avoid truncation issues with slug generation
   */
  private generateUniqueName(baseName: string): string {
    return `${randomUUID()}-${baseName}-${this.testId}`;
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
   * Cleans up test data by deleting profiles, users, and auth users created for this test.
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

    // 2. Delete users table rows by auth user IDs
    // This must happen before deleting auth users since users.authUserId references auth.users
    if (this.createdAuthUserIds.length > 0) {
      await db
        .delete(users)
        .where(inArray(users.authUserId, this.createdAuthUserIds));
    }

    // 3. Delete auth users by exact IDs
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

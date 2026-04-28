import type {
  DecisionSchemaDefinition,
  ProposalTemplateSchema,
} from '@op/common';
import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
  accessRolePermissionsOnAccessZones,
  accessRoles,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  proposals,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import {
  addUserToOrganization,
  createOrganization,
  createUser,
  generateTestEmail,
} from './test-data';

/** Well-known slug for the seeded decision template profile */
export const SEEDED_TEMPLATE_PROFILE_SLUG = 'decision-template-library';

/** Well-known name for the seeded Simple Voting template */
export const SEEDED_SIMPLE_VOTING_TEMPLATE_NAME = 'Simple Voting';

/**
 * A simple voting schema for testing.
 */
export const testSimpleVotingSchema = {
  id: 'simple',
  version: '1.0.0',
  name: 'Simple Voting',
  description:
    'Basic approval voting where members vote for multiple proposals.',
  proposalTemplate: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Proposal title',
        'x-format': 'short-text',
      },
      summary: {
        type: 'string',
        title: 'Proposal summary',
        'x-format': 'long-text',
      },
      budget: {
        type: 'object',
        title: 'Budget',
        'x-format': 'money',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', default: 'USD' },
        },
      },
    },
    'x-field-order': ['title', 'budget', 'summary'],
    required: ['title', 'summary'],
  },
  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'date' as const, endDate: '2026-01-01' },
      },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      description: 'Reviewers evaluate and shortlist proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date' as const, endDate: '2026-01-02' },
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-03' },
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'View final results and winning proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date' as const, endDate: '2026-01-04' },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

/**
 * A minimal test schema with just two phases for simpler unit tests.
 */
export const testMinimalSchema = {
  id: 'test-schema',
  version: '1.0.0',
  name: 'Test Schema',
  description: 'A simple schema for testing',
  phases: [
    {
      id: 'initial',
      name: 'Initial Phase',
      description: 'The starting phase',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
      // Explicit pass-all so every submitted proposal advances on transition.
      // (advancePhase defaults to pass-none when no pipeline is configured.)
      selectionPipeline: { version: '1.0.0' as const, blocks: [] },
    },
    {
      id: 'final',
      name: 'Final Phase',
      description: 'The ending phase',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'manual' as const },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

export interface CreateDecisionProcessOptions {
  /** Profile ID of the user creating the process */
  createdByProfileId: string;
  /** Optional name for the process (auto-generated if not provided) */
  name?: string;
  /** Optional description for the process */
  description?: string;
  /** Schema to use for the process (defaults to testSimpleVotingSchema) */
  schema?: DecisionSchemaDefinition;
}

export interface CreateDecisionProcessResult {
  id: string;
  name: string;
  description: string | null;
  processSchema: DecisionSchemaDefinition;
  createdByProfileId: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Creates a decision process template for testing.
 * Returns the created process record with all fields.
 */
export async function createDecisionProcess(
  opts: CreateDecisionProcessOptions,
): Promise<CreateDecisionProcessResult> {
  const {
    createdByProfileId,
    name = `Test Process ${randomUUID().slice(0, 8)}`,
    description,
    schema = testSimpleVotingSchema,
  } = opts;

  const [processRecord] = await db
    .insert(decisionProcesses)
    .values({
      name,
      description: description ?? schema.description,
      processSchema: schema,
      createdByProfileId,
    })
    .returning();

  if (!processRecord) {
    throw new Error('Failed to create decision process');
  }

  return {
    id: processRecord.id,
    name: processRecord.name,
    description: processRecord.description,
    processSchema: processRecord.processSchema as DecisionSchemaDefinition,
    createdByProfileId: processRecord.createdByProfileId,
    createdAt: processRecord.createdAt,
    updatedAt: processRecord.updatedAt,
  };
}

export interface CreateDecisionInstanceOptions {
  /** ID of the decision process template */
  processId: string;
  /** Profile ID of the organization/entity that owns this instance */
  ownerProfileId: string;
  /** Auth user ID to grant access to */
  authUserId: string;
  /** Email of the user to grant access to */
  email: string;
  /** Optional name for the instance (auto-generated if not provided) */
  name?: string;
  /** Schema to use for generating instance data (defaults to testSimpleVotingSchema) */
  schema?: DecisionSchemaDefinition;
  /** Status of the instance (defaults to PUBLISHED) */
  status?: ProcessStatus;
  /** Whether to grant admin access (defaults to true) */
  grantAdminAccess?: boolean;
  /** Optional override for proposalTemplate in instanceData (for testing legacy templates) */
  proposalTemplate?: ProposalTemplateSchema;
}

export interface CreateDecisionInstanceResult {
  instance: typeof processInstances.$inferSelect;
  profileId: string;
  slug: string;
  name: string;
}

/**
 * Creates a decision instance with proper profile and user access.
 * This creates:
 * - A profile for the decision instance (EntityType.DECISION)
 * - A process instance record linked to the process template
 * - Profile user access for the specified user
 */
export async function createDecisionInstance(
  opts: CreateDecisionInstanceOptions,
): Promise<CreateDecisionInstanceResult> {
  const {
    processId,
    ownerProfileId,
    authUserId,
    email,
    name = `Test Instance ${randomUUID()}`,
    schema = testSimpleVotingSchema,
    status = ProcessStatus.PUBLISHED,
    grantAdminAccess = true,
    proposalTemplate: proposalTemplateOverride,
  } = opts;

  const instanceSlug = `test-instance-${randomUUID()}`;
  const firstPhaseId = schema.phases[0]?.id ?? 'submission';

  // 1. Create a profile for the process instance with DECISION type
  const [instanceProfile] = await db
    .insert(profiles)
    .values({
      name,
      slug: instanceSlug,
      type: EntityType.DECISION,
    })
    .returning();

  if (!instanceProfile) {
    throw new Error('Failed to create instance profile');
  }

  // 2. Create the process instance with proper instanceData structure
  const instanceData = {
    templateId: schema.id,
    templateVersion: schema.version,
    templateName: schema.name,
    templateDescription: schema.description,
    phases: schema.phases.map((phase, index) => ({
      phaseId: phase.id,
      name: phase.name,
      description: phase.description,
      rules: phase.rules,
      startDate: new Date(
        Date.now() + index * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      endDate: new Date(
        Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })),
    proposalTemplate: proposalTemplateOverride ?? {
      type: 'object' as const,
      required: ['title'],
      'x-field-order': ['title', 'budget', 'summary'],
      properties: {
        title: {
          type: 'string' as const,
          title: 'Title',
          'x-format': 'short-text',
        },
        budget: {
          type: 'object' as const,
          title: 'Budget',
          'x-format': 'money',
          properties: {
            amount: { type: 'number' as const },
            currency: { type: 'string' as const, default: 'USD' },
          },
        },
        summary: {
          type: 'string' as const,
          title: 'Summary',
          'x-format': 'long-text',
        },
      },
    },
  };

  const [processInstance] = await db
    .insert(processInstances)
    .values({
      name,
      processId,
      profileId: instanceProfile.id,
      instanceData,
      currentStateId: firstPhaseId,
      status,
      ownerProfileId,
      stewardProfileId: ownerProfileId,
    })
    .returning();

  if (!processInstance) {
    throw new Error('Failed to create process instance');
  }

  // 3. Grant the user access to the decision profile
  if (grantAdminAccess) {
    await grantDecisionProfileAccess({
      profileId: instanceProfile.id,
      authUserId,
      email,
      isAdmin: true,
    });
  }

  return {
    instance: processInstance,
    profileId: instanceProfile.id,
    slug: instanceSlug,
    name,
  };
}

export interface GrantDecisionProfileAccessOptions {
  /** Profile ID to grant access to */
  profileId: string;
  /** Auth user ID */
  authUserId: string;
  /** User email */
  email: string;
  /** Whether to grant admin role (true) or member role (false) */
  isAdmin?: boolean;
}

/**
 * Grants a user access to a decision profile with the specified role.
 */
export async function grantDecisionProfileAccess(
  opts: GrantDecisionProfileAccessOptions,
): Promise<void> {
  const { profileId, authUserId, email, isAdmin = true } = opts;

  const [profileUser] = await db
    .insert(profileUsers)
    .values({
      profileId,
      authUserId,
      email,
    })
    .returning();

  if (profileUser) {
    await db.insert(profileUserToAccessRoles).values({
      profileUserId: profileUser.id,
      accessRoleId: isAdmin ? ROLES.ADMIN.id : ROLES.MEMBER.id,
    });
  }
}

/**
 * Grants the user a custom "Reviewer" role on the instance profile with
 * READ + REVIEW on the decisions zone (plus the implicit profile READ).
 * Creates the role on the fly and inserts/reuses a profileUser row.
 *
 * Mirrors the capabilities surfaced by `createDecisionRole` in @op/common
 * without importing it (keeps this package free of server-only deps).
 */
export async function grantInstanceReviewerRole(opts: {
  instanceProfileId: string;
  authUserId: string;
  email: string;
  roleName?: string;
}): Promise<void> {
  const { instanceProfileId, authUserId, email, roleName = 'Reviewer' } = opts;

  const [decisionsZone, profileZone] = await Promise.all([
    db.query.accessZones.findFirst({ where: { name: 'decisions' } }),
    db.query.accessZones.findFirst({ where: { name: 'profile' } }),
  ]);

  if (!decisionsZone || !profileZone) {
    throw new Error(
      'Access zones not seeded (expected "decisions" and "profile")',
    );
  }

  const [role] = await db
    .insert(accessRoles)
    .values({ name: roleName, profileId: instanceProfileId })
    .returning();

  if (!role) {
    throw new Error(`Failed to create Reviewer role on ${instanceProfileId}`);
  }

  // permission.READ = 4 (ACRUD bit 2), decisionPermission.REVIEW = 0b10_00000 = 64.
  // Duplicated to avoid pulling in access-zones/@op/common at runtime.
  const READ = 4;
  const REVIEW = 64;

  await db.insert(accessRolePermissionsOnAccessZones).values([
    {
      accessRoleId: role.id,
      accessZoneId: decisionsZone.id,
      permission: READ | REVIEW,
    },
    {
      accessRoleId: role.id,
      accessZoneId: profileZone.id,
      permission: READ,
    },
  ]);

  // Reuse an existing profileUsers row (e.g. created by createInstanceMember)
  // or insert a fresh one. Either way, attach the Reviewer role to it.
  const existing = await db.query.profileUsers.findFirst({
    where: { profileId: instanceProfileId, authUserId },
    columns: { id: true },
  });

  let profileUserId: string;
  if (existing) {
    profileUserId = existing.id;
  } else {
    const [profileUser] = await db
      .insert(profileUsers)
      .values({ profileId: instanceProfileId, authUserId, email })
      .returning();
    if (!profileUser) {
      throw new Error(
        `Failed to create profileUser for ${email} on ${instanceProfileId}`,
      );
    }
    profileUserId = profileUser.id;
  }

  await db
    .insert(profileUserToAccessRoles)
    .values({ profileUserId, accessRoleId: role.id });
}

export interface CreateInstanceMemberOptions {
  supabaseAdmin: SupabaseClient;
  /** Unique identifier appended to the generated email */
  testId: string;
  /**
   * Existing organization the new user will join. Omit to create a fresh
   * throwaway organization (useful for e2e tests that want a user entirely
   * outside the worker org).
   */
  organization?: { id: string };
  /** Decision instance profile to grant access on */
  instanceProfileId: string;
  /**
   * Role granted on the instance profile. Defaults to Member (READ on the
   * decisions zone) — the useful case for asserting that non-reviewer,
   * non-admin participants cannot see reviewer-scoped data.
   */
  isInstanceAdmin?: boolean;
  /**
   * Role within the *existing* organization. Ignored when `organization` is
   * omitted — the throwaway path creates the user as that org's admin.
   * Defaults to Member.
   */
  organizationRole?: 'Admin' | 'Member';
}

export interface CreateInstanceMemberResult {
  user: {
    authUserId: string;
    email: string;
    profileId: string;
    organizationUserId: string;
  };
  /** The organization the user belongs to (existing or freshly created). */
  organization: { id: string };
}

/**
 * Creates a user and grants them access on a decision instance profile.
 * If `organization` is supplied, the user is added there; otherwise a
 * fresh throwaway org is created with the user as its admin.
 *
 * Defaults to Member on the instance profile — the caller ends up with
 * READ on the decisions zone but no REVIEW / ADMIN.
 */
export async function createInstanceMember(
  opts: CreateInstanceMemberOptions,
): Promise<CreateInstanceMemberResult> {
  const {
    supabaseAdmin,
    testId,
    organization,
    instanceProfileId,
    isInstanceAdmin = false,
    organizationRole = 'Member',
  } = opts;

  if (organization) {
    const email = generateTestEmail(testId, organizationRole);
    const authUser = await createUser({ supabaseAdmin, email });

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, authUser.id));

    if (!userRecord?.profileId) {
      throw new Error(`Failed to find user record for ${email}`);
    }

    const orgUser = await addUserToOrganization({
      authUserId: authUser.id,
      organizationId: organization.id,
      email,
      role: organizationRole,
    });

    await grantDecisionProfileAccess({
      profileId: instanceProfileId,
      authUserId: authUser.id,
      email,
      isAdmin: isInstanceAdmin,
    });

    return {
      user: {
        authUserId: authUser.id,
        email,
        profileId: userRecord.profileId,
        organizationUserId: orgUser.id,
      },
      organization: { id: organization.id },
    };
  }

  const createdOrg = await createOrganization({
    testId,
    supabaseAdmin,
    users: { admin: 1, member: 0 },
  });

  await grantDecisionProfileAccess({
    profileId: instanceProfileId,
    authUserId: createdOrg.adminUser.authUserId,
    email: createdOrg.adminUser.email,
    isAdmin: isInstanceAdmin,
  });

  return {
    user: {
      authUserId: createdOrg.adminUser.authUserId,
      email: createdOrg.adminUser.email,
      profileId: createdOrg.adminUser.profileId,
      organizationUserId: createdOrg.adminUser.organizationUserId,
    },
    organization: { id: createdOrg.organization.id },
  };
}

/**
 * Gets the seeded Simple Voting template from the database.
 * This template is created by seed-test.ts and should always exist in test/e2e environments.
 */
export async function getSeededTemplate(): Promise<{
  id: string;
  name: string;
  processSchema: DecisionSchemaDefinition;
}> {
  const [template] = await db
    .select()
    .from(decisionProcesses)
    .where(eq(decisionProcesses.name, SEEDED_SIMPLE_VOTING_TEMPLATE_NAME));

  if (!template) {
    throw new Error(
      `Seeded template "${SEEDED_SIMPLE_VOTING_TEMPLATE_NAME}" not found. Make sure seed-test.ts has been run.`,
    );
  }

  return {
    id: template.id,
    name: template.name,
    processSchema: template.processSchema as DecisionSchemaDefinition,
  };
}

/**
 * Fetches a decision instance by ID from the database.
 * Returns the full instance record including instanceData.
 */
export async function getDecisionInstance(
  instanceId: string,
): Promise<typeof processInstances.$inferSelect> {
  const [instance] = await db
    .select()
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));

  if (!instance) {
    throw new Error(`Decision instance "${instanceId}" not found`);
  }

  return instance;
}

export interface CreateProposalOptions {
  /** Process instance ID this proposal belongs to */
  processInstanceId: string;
  /** Profile ID of the user submitting the proposal */
  submittedByProfileId: string;
  /** Structured proposal data (title, description, collaborationDocId, etc.) */
  proposalData: {
    title: string;
    description?: string;
    collaborationDocId?: string;
    budget?: number | { amount: number; currency: string };
    category?: string;
    /** Allow arbitrary extra fields for dynamic template properties (dropdowns, etc.) */
    [key: string]: unknown;
  };
  /** Proposal status (defaults to DRAFT to match production behavior) */
  status?: ProposalStatus;
  /**
   * Auth user ID of the proposal creator. When provided (along with email),
   * a profileUsers record is created on the proposal's profile — matching
   * production behavior where the creator gets proposal-level access.
   * Required for draft proposals to be visible in listProposals.
   */
  authUserId?: string;
  /** Email of the proposal creator (required when authUserId is provided) */
  email?: string;
}

export interface CreateProposalResult {
  id: string;
  profileId: string;
  processInstanceId: string;
  proposalData: Record<string, unknown>;
  status: string | null;
}

/**
 * Creates a proposal with its own profile via direct DB insert.
 * Mirrors the production code path in @op/common/createProposal as closely as possible:
 * - Generates a collaborationDocId if not provided
 * - Defaults to DRAFT status (matching production)
 *
 * NOTE: Cannot call @op/common directly because it lacks "type": "module"
 * in package.json, causing CJS/ESM interop failures under Playwright's Node runtime.
 */
export async function createProposal(
  opts: CreateProposalOptions,
): Promise<CreateProposalResult> {
  const {
    processInstanceId,
    submittedByProfileId,
    proposalData,
    status = ProposalStatus.DRAFT,
    authUserId,
    email,
  } = opts;

  const proposalId = randomUUID();
  const proposalSlug = `proposal-${randomUUID()}`;

  // For legacy proposals with a description field, don't generate a collaborationDocId.
  // This mirrors pre-TipTap proposals that only had raw HTML in `description`.
  const storedProposalData = proposalData.description
    ? proposalData
    : {
        ...proposalData,
        collaborationDocId:
          proposalData.collaborationDocId ?? `proposal-${proposalId}`,
      };

  // Create a profile for the proposal (needed for social features: likes, comments)
  const [proposalProfile] = await db
    .insert(profiles)
    .values({
      name: proposalData.title,
      slug: proposalSlug,
      type: EntityType.PROPOSAL,
    })
    .returning();

  if (!proposalProfile) {
    throw new Error('Failed to create proposal profile');
  }

  // Grant the creator proposal-level access (mirrors production createProposal behavior).
  // This is required for draft proposals to be visible in listProposals, which filters
  // drafts by profileUsers on the proposal's profile.
  if (authUserId && email) {
    const [proposalProfileUser] = await db
      .insert(profileUsers)
      .values({
        profileId: proposalProfile.id,
        authUserId,
        email,
        isOwner: true,
      })
      .returning();

    if (proposalProfileUser) {
      await db.insert(profileUserToAccessRoles).values({
        profileUserId: proposalProfileUser.id,
        accessRoleId: ROLES.ADMIN.id,
      });
    }
  }

  const [proposal] = await db
    .insert(proposals)
    .values({
      id: proposalId,
      processInstanceId,
      submittedByProfileId,
      profileId: proposalProfile.id,
      proposalData: storedProposalData,
      status,
    })
    .returning();

  if (!proposal) {
    throw new Error('Failed to create proposal');
  }

  return {
    id: proposal.id,
    profileId: proposalProfile.id,
    processInstanceId: proposal.processInstanceId,
    proposalData: proposal.proposalData as Record<string, unknown>,
    status: proposal.status,
  };
}

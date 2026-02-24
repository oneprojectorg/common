import type {
  DecisionSchemaDefinition,
  ProposalTemplateSchema,
} from '@op/common';
import {
  EntityType,
  ProcessStatus,
  ProposalStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';

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
    },
    'x-field-order': ['title', 'summary'],
    required: ['summary', 'title'],
  },
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
    },
    'x-field-order': ['title', 'summary'],
    required: ['title'],
  },
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
    currentPhaseId: firstPhaseId,
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

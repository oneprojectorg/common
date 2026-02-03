import { db } from '@op/db';
import {
  EntityType,
  ProcessStatus,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/** Well-known slug for the seeded decision template profile */
export const SEEDED_TEMPLATE_PROFILE_SLUG = 'decision-template-library';

/** Well-known name for the seeded Simple Voting template */
export const SEEDED_SIMPLE_VOTING_TEMPLATE_NAME = 'Simple Voting';

/**
 * Decision schema phase definition.
 * Matches the DecisionSchemaDefinition structure from @op/common.
 */
export interface DecisionPhaseSchema {
  id: string;
  name: string;
  description?: string;
  rules: {
    proposals?: { submit?: boolean; edit?: boolean };
    voting?: { submit?: boolean; edit?: boolean };
    advancement?: { method: 'date' | 'manual'; endDate?: string };
  };
  settings?: Record<string, unknown>;
  selectionPipeline?: Record<string, unknown>;
  startDate?: string;
  endDate?: string;
}

/**
 * Decision schema definition.
 * Matches the DecisionSchemaDefinition structure from @op/common.
 */
export interface DecisionProcessSchema {
  id: string;
  version: string;
  name: string;
  description?: string;
  config?: { hideBudget?: boolean };
  phases: DecisionPhaseSchema[];
  proposalTemplate?: Record<string, unknown>;
}

/**
 * A simple voting schema for testing.
 * This mirrors the simpleVoting schema from @op/common but is self-contained
 * to avoid ESM/CJS import issues across different test environments.
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
};

/**
 * A minimal test schema with just two phases for simpler unit tests.
 * Matches the legacy testDecisionSchema used in TestDecisionsDataManager.
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
};

export interface CreateDecisionProcessOptions {
  /** Profile ID of the user creating the process */
  createdByProfileId: string;
  /** Optional name for the process (auto-generated if not provided) */
  name?: string;
  /** Optional description for the process */
  description?: string;
  /** Schema to use for the process (defaults to testSimpleVotingSchema) */
  schema?: DecisionProcessSchema;
}

export interface CreateDecisionProcessResult {
  id: string;
  name: string;
  description: string | null;
  processSchema: DecisionProcessSchema;
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
    processSchema: processRecord.processSchema as DecisionProcessSchema,
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
  schema?: DecisionProcessSchema;
  /** Status of the instance (defaults to PUBLISHED) */
  status?: ProcessStatus;
  /** Whether to grant admin access (defaults to true) */
  grantAdminAccess?: boolean;
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
    currentPhaseId: firstPhaseId,
    phases: schema.phases.map((phase, index) => ({
      phaseId: phase.id,
      rules: phase.rules,
      startDate: new Date(
        Date.now() + index * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      endDate: new Date(
        Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })),
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
  processSchema: DecisionProcessSchema;
}> {
  const [template] = await db
    .select()
    .from(decisionProcesses)
    .where(eq(decisionProcesses.name, SEEDED_SIMPLE_VOTING_TEMPLATE_NAME));

  if (!template) {
    throw new Error(
      `Seeded template "${SEEDED_SIMPLE_VOTING_TEMPLATE_NAME}" not found. ` +
        'Make sure seed-test.ts has been run.',
    );
  }

  return {
    id: template.id,
    name: template.name,
    processSchema: template.processSchema as DecisionProcessSchema,
  };
}

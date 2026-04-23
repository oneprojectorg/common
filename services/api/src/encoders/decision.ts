import {
  REVIEWS_POLICIES,
  checkpointVersionSchema,
  proposalSchema,
} from '@op/common/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  decisions,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './profiles';

// JSON Schema types
const jsonSchemaEncoder = z.record(z.string(), z.unknown());

/**
 * Typed encoder for rubric templates (READ path only).
 *
 * This provides strict typing so the frontend receives properly typed data
 * from `instanceData.rubricTemplate` without needing type assertions.
 *
 * For the WRITE path (mutations), we use `jsonSchemaEncoder` instead because
 * the frontend sends `RubricTemplateSchema` which extends `JSONSchema7` - a
 * much broader type that doesn't fit this strict schema. Runtime validation
 * still occurs via Zod; this encoder is primarily for TypeScript inference.
 */
const rubricTemplateEncoder = z
  .object({
    type: z.literal('object'),
    properties: z
      .record(
        z.string(),
        z
          .object({
            type: z.string().optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            minimum: z.number().optional(),
            maximum: z.number().optional(),
            oneOf: z
              .array(
                z.object({
                  const: z.union([z.number(), z.string()]),
                  title: z.string(),
                }),
              )
              .optional(),
            'x-format': z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    required: z.array(z.string()).optional(),
    'x-field-order': z.array(z.string()).optional(),
  })
  .passthrough();

// ============================================================================
// ProcessPhase encoder (for frontend UI components)
// ============================================================================

/** Process phase encoder for UI display (stepper, stats, etc.) */
export const processPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  phase: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .optional(),
  type: z.enum(['initial', 'intermediate', 'final']).optional(),
  config: z
    .object({
      allowProposals: z.boolean().optional(),
    })
    .optional(),
  advancementMethod: z.enum(['date', 'manual']).optional(),
});

export type ProcessPhase = z.infer<typeof processPhaseSchema>;

// ============================================================================
// DecisionSchemaDefinition format encoders
// ============================================================================

/** Phase behavior rules  */
const phaseRulesEncoder = z.object({
  proposals: z
    .object({
      submit: z.boolean().optional(),
      edit: z.boolean().optional(),
      review: z.boolean().optional(),
    })
    .optional(),
  voting: z
    .object({
      submit: z.boolean().optional(),
      edit: z.boolean().optional(),
    })
    .optional(),
  advancement: z
    .object({
      method: z.enum(['date', 'manual']),
      endDate: z.string().optional(),
    })
    .optional(),
});

/** Selection pipeline block encoder */
const selectionPipelineBlockEncoder = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().optional(),
  sortBy: z
    .array(
      z.object({
        field: z.string(),
        order: z.enum(['asc', 'desc']).optional(),
      }),
    )
    .optional(),
  count: z.union([z.number(), z.object({ variable: z.string() })]).optional(),
  conditions: z.array(z.unknown()).optional(),
});

/** Selection pipeline encoder */
const selectionPipelineEncoder = z.object({
  version: z.string(),
  blocks: z.array(selectionPipelineBlockEncoder),
});

/** Phase definition encoder (includes merged instance dates) */
const phaseDefinitionEncoder = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  headline: z.string().optional(),
  additionalInfo: z.string().optional(),
  rules: phaseRulesEncoder,
  selectionPipeline: selectionPipelineEncoder.optional(),
  settings: jsonSchemaEncoder.optional(),
  // Instance-specific dates (merged from instanceData.phases)
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/** Category item encoder */
const categoryEncoder = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

/** Reviews policy enum */
const reviewsPolicyEncoder = z.enum(REVIEWS_POLICIES);

/** Process-level configuration */
const processConfigEncoder = z.object({
  hideBudget: z.boolean().optional(),
  categories: z.array(categoryEncoder).optional(),
  requireCategorySelection: z.boolean().optional(),
  allowMultipleCategories: z.boolean().optional(),
  organizeByCategories: z.boolean().optional(),
  requireCollaborativeProposals: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  reviewsPolicy: reviewsPolicyEncoder.optional(),
  reviewsAllowRevisions: z.boolean().optional(),
  reviewsAnonymousFeedback: z.boolean().optional(),
});

/** DecisionSchemaDefinition encoder */
export const decisionSchemaDefinitionEncoder = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: processConfigEncoder.optional(),
  phases: z.array(phaseDefinitionEncoder).min(1),
  // Optional proposal template for budget/field configuration (legacy compatibility)
  proposalTemplate: jsonSchemaEncoder.optional(),
  rubricTemplate: rubricTemplateEncoder.optional(),
});

/** Decision process encoder */
export const decisionProcessWithSchemaEncoder = createSelectSchema(
  decisionProcesses,
)
  .pick({
    id: true,
    name: true,
    description: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    processSchema: decisionSchemaDefinitionEncoder,
    createdBy: baseProfileEncoder.optional(),
  });

/** List encoder for decision processes */
export const decisionProcessWithSchemaListEncoder = z.object({
  processes: z.array(decisionProcessWithSchemaEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

/** Instance-specific phase data (overrides for dates, rules, settings) */
export const instancePhaseDataEncoder = z.object({
  phaseId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  headline: z.string().optional(),
  additionalInfo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rules: phaseRulesEncoder.optional(),
  selectionPipeline: selectionPipelineEncoder.optional(),
  settingsSchema: jsonSchemaEncoder.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/** Instance data encoder for new schema format */
const instanceDataWithSchemaEncoder = z.object({
  config: processConfigEncoder.optional(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  templateId: z.string().optional(),
  templateVersion: z.string().optional(),
  templateName: z.string().optional(),
  templateDescription: z.string().optional(),
  phases: z.array(instancePhaseDataEncoder).optional(),
  proposalTemplate: jsonSchemaEncoder.optional(),
  rubricTemplate: rubricTemplateEncoder.optional(),
});

/** Decision access permissions encoder */
const decisionAccessEncoder = z.object({
  delete: z.boolean(),
  update: z.boolean(),
  read: z.boolean(),
  create: z.boolean(),
  admin: z.boolean(),
  inviteMembers: z.boolean(),
  review: z.boolean(),
  submitProposals: z.boolean(),
  vote: z.boolean(),
});
export type DecisionAccess = z.infer<typeof decisionAccessEncoder>;

/** Process instance encoder  */
export const processInstanceWithSchemaEncoder = createSelectSchema(
  processInstances,
)
  .pick({
    id: true,
    profileId: true,
    name: true,
    description: true,
    instanceData: true,
    currentStateId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    instanceData: instanceDataWithSchemaEncoder,
    process: decisionProcessWithSchemaEncoder.optional(),
    owner: baseProfileEncoder.optional(),
    steward: baseProfileEncoder.nullish(),
    proposalCount: z.number().optional(),
    participantCount: z.number().optional(),
    access: decisionAccessEncoder.optional(),
  });

/** Decision profile encoder  */
export const decisionProfileWithSchemaEncoder = baseProfileEncoder.extend({
  processInstance: processInstanceWithSchemaEncoder,
});

/** Decision profile list encoder  */
export const decisionProfileWithSchemaListEncoder = z.object({
  items: z.array(decisionProfileWithSchemaEncoder),
  next: z.string().nullish(),
});

/** Decision statuses visible on profile pages (excludes drafts) */
export const VISIBLE_DECISION_STATUSES = [
  ProcessStatus.PUBLISHED,
  ProcessStatus.COMPLETED,
  ProcessStatus.CANCELLED,
];

/** Decision profile filter schema */
export const decisionProfileWithSchemaFilterSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(100).prefault(10),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).prefault('updatedAt'),
  dir: z.enum(['asc', 'desc']).prefault('desc'),
  search: z.string().optional(),
  status: z.array(z.enum(ProcessStatus)).optional(),
  ownerProfileId: z.uuid().optional(),
  stewardProfileId: z.uuid().optional(),
});

// =============================================================================
// Process Schema Encoder (new format with passthrough for flexibility)
// =============================================================================
const processSchemaEncoder = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    id: z.string().optional(),
    version: z.string().optional(),
    config: z
      .object({
        hideBudget: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    phases: z
      .array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
            rules: phaseRulesEncoder.optional(),
            selectionPipeline: selectionPipelineEncoder.optional(),
            settings: jsonSchemaEncoder.optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    proposalTemplate: jsonSchemaEncoder.optional(),
  })
  .passthrough();

// Instance Data Encoder that supports both new and legacy field names
const instanceDataEncoder = z.preprocess(
  (data) => {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    const obj = data as Record<string, unknown>;
    // Map legacy field names to new names:
    // - phases[].stateId → phases[].phaseId
    // - phases[].plannedStartDate → phases[].startDate
    // - phases[].plannedEndDate → phases[].endDate
    const phases = Array.isArray(obj.phases)
      ? obj.phases.map((phase) => {
          if (typeof phase !== 'object' || phase === null) {
            return phase;
          }
          const p = phase as Record<string, unknown>;
          return {
            ...p,
            phaseId: p.phaseId ?? p.stateId,
            startDate: p.startDate ?? p.plannedStartDate,
            endDate: p.endDate ?? p.plannedEndDate,
          };
        })
      : obj.phases;
    return {
      ...obj,
      phases,
    };
  },
  z.object({
    budget: z.number().optional(),
    hideBudget: z.boolean().optional(),
    fieldValues: z.record(z.string(), z.unknown()).optional(),
    phases: z
      .array(
        z.object({
          phaseId: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }),
      )
      .optional(),
  }),
);

// Decision Process Encoder
export const decisionProcessEncoder = createSelectSchema(decisionProcesses)
  .pick({
    id: true,
    name: true,
    description: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    processSchema: processSchemaEncoder,
    createdBy: baseProfileEncoder.optional(),
  });

// Process Instance Encoder
export const processInstanceEncoder = createSelectSchema(processInstances)
  .pick({
    id: true,
    name: true,
    description: true,
    instanceData: true,
    currentStateId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    instanceData: instanceDataEncoder,
    process: decisionProcessEncoder.optional(),
    owner: baseProfileEncoder.optional(),
    proposalCount: z.number().optional(),
    participantCount: z.number().optional(),
  });

export const proposalVersionEncoder = z.object({
  version: z.number(),
  createdAt: z.string(),
  name: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const proposalVersionListEncoder = z.object({
  // Ordered newest-first (descending by integer version) by the service layer.
  versions: z.array(proposalVersionEncoder),
});

// Decision Encoder
export const decisionEncoder = createSelectSchema(decisions)
  .pick({
    id: true,
    decisionData: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    proposal: proposalSchema.optional(),
    decidedBy: baseProfileEncoder.optional(),
  });

// State Transition History Encoder
export const stateTransitionHistoryEncoder = createSelectSchema(
  stateTransitionHistory,
)
  .pick({
    id: true,
    fromStateId: true,
    toStateId: true,
    transitionData: true,
    transitionedAt: true,
  })
  .extend({
    triggeredBy: baseProfileEncoder.optional(),
  });

// List Encoders (for paginated responses)
export const decisionProcessListEncoder = z.object({
  processes: z.array(decisionProcessEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const processInstanceListEncoder = z.object({
  instances: z.array(processInstanceEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const instanceResultsEncoder = z.object({
  items: z.array(proposalSchema),
  next: z.string().nullish(),
});

export const decisionListEncoder = z.object({
  decisions: z.array(decisionEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

// Input Schemas
export const createProcessInputSchema = z.object({
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  processSchema: processSchemaEncoder,
});

export const updateProcessInputSchema = createProcessInputSchema.partial();

export const createInstanceInputSchema = z.object({
  processId: z.uuid(),
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  instanceData: instanceDataEncoder,
});

export const createInstanceFromTemplateInputSchema = z.object({
  templateId: z.uuid(),
  name: z.string().min(3).max(256),
});

/** Input schema for phase overrides with datetime validation */
const instancePhaseDataInputEncoder = instancePhaseDataEncoder.extend({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

export const updateDecisionInstanceInputSchema = z.object({
  instanceId: z.uuid(),
  name: z.string().max(256).optional(),
  description: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  stewardProfileId: z.string().uuid().optional(),
  /** Process-level configuration (e.g., hideBudget, categories) */
  config: processConfigEncoder.optional(),
  /** Phase overrides for dates, rules, and settings */
  phases: z.array(instancePhaseDataInputEncoder).optional(),
  /** Proposal template (JSON Schema) */
  proposalTemplate: jsonSchemaEncoder.optional(),
  /**
   * Rubric template (JSON Schema defining evaluation criteria).
   * Uses loose jsonSchemaEncoder for input because the frontend sends
   * RubricTemplateSchema (extends JSONSchema7). See rubricTemplateEncoder
   * for the typed read path.
   */
  rubricTemplate: jsonSchemaEncoder.optional(),
});

export const updateInstanceInputSchema = createInstanceInputSchema
  .omit({ processId: true })
  .partial()
  .extend({
    instanceId: z.uuid(),
    status: z.enum(ProcessStatus).optional(),
  });

export const getInstanceInputSchema = z.object({
  instanceId: z.uuid(),
});

export const createProposalInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalData: z.record(z.string(), z.unknown()),
  attachmentIds: z.array(z.string()).optional(), // Array of attachment IDs to link to this proposal
});

export const updateProposalInputSchema = createProposalInputSchema
  .omit({ processInstanceId: true })
  .partial()
  .extend({
    title: z.string().optional(),
    visibility: z.enum(Visibility).optional(),
    /**
     * Evaluation status for the proposal. This update endpoint handles evaluation
     * status changes (shortlisted, approved, rejected, etc.) - not submission state.
     *
     * NOTE: To be looked at again - draft/submitted represent the submission lifecycle
     * (whether a proposal has been finalized by its author), while the statuses below
     * represent how the proposal has been evaluated by reviewers/admins. These are
     * conceptually different and may warrant separate fields in the future.
     *
     * Use submitProposal endpoint for draft→submitted transition.
     */
    status: z
      .enum([
        ProposalStatus.SHORTLISTED,
        ProposalStatus.UNDER_REVIEW,
        ProposalStatus.APPROVED,
        ProposalStatus.REJECTED,
        ProposalStatus.DUPLICATE,
        ProposalStatus.SELECTED,
      ])
      .optional(),
    /** Stamps a TipTap version snapshot for the collaboration document. */
    checkpointVersion: checkpointVersionSchema.optional(),
  });

export const submitDecisionInputSchema = z.object({
  proposalId: z.uuid(),
  decisionData: z.record(z.string(), z.unknown()), // Decision data matching voting definition
});

// Transition Schemas
export const executeTransitionInputSchema = z.object({
  instanceId: z.uuid(),
  toStateId: z.string(),
  transitionData: z.record(z.string(), z.unknown()).optional(),
});

export const checkTransitionInputSchema = z.object({
  instanceId: z.uuid(),
  toStateId: z.string().optional(), // If not provided, check all possible transitions
});

export const transitionCheckResultEncoder = z.object({
  canTransition: z.boolean(),
  availableTransitions: z.array(
    z.object({
      toStateId: z.string(),
      transitionName: z.string(),
      canExecute: z.boolean(),
      failedRules: z.array(
        z.object({
          ruleId: z.string(),
          errorMessage: z.string(),
        }),
      ),
    }),
  ),
});

// Pagination Schema
export const paginationInputSchema = z.object({
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
});

// Filter Schemas
export const processFilterSchema = z
  .object({
    createdByProfileId: z.uuid().optional(),
    search: z.string().optional(),
  })
  .extend(paginationInputSchema.shape);

export const instanceFilterSchema = z
  .object({
    processId: z.uuid().optional(),
    ownerProfileId: z.uuid().optional(),
    stewardProfileId: z.uuid().optional(),
    status: z.enum(ProcessStatus).optional(),
    search: z.string().optional(),
  })
  .extend(paginationInputSchema.shape);

export const proposalFilterSchema = z
  .object({
    processInstanceId: z.uuid(),
    submittedByProfileId: z.uuid().optional(),
    status: z.enum(ProposalStatus).optional(),
    categoryId: z.string().optional(),
    dir: z.enum(['asc', 'desc']).optional(),
    /** Phase ID to scope proposals to. Defaults to the current phase when omitted. */
    phaseId: z.string().optional(),
    /**
     * Restrict results to proposals voted on by this profile. Bypasses phase
     * scoping so a user's ballot remains accessible after the process moves
     * past the voting phase.
     */
    votedByProfileId: z.uuid().optional(),
    /** When set to 'results', all proposals are returned as non-editable */
    phase: z.enum(['results']).optional(),
  })
  .extend(paginationInputSchema.shape);

// Decision Profile Encoder (profile with processInstance)
export const decisionProfileEncoder = baseProfileEncoder.extend({
  processInstance: processInstanceEncoder,
});

// Decision Profile List Encoder
export const decisionProfileListEncoder = z.object({
  items: z.array(decisionProfileEncoder),
  next: z.string().nullish(),
});

// Decision Profile Filter Schema
export const decisionProfileFilterSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(100).prefault(10),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).prefault('updatedAt'),
  dir: z.enum(['asc', 'desc']).prefault('desc'),
  search: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  ownerProfileId: z.uuid().optional(),
  stewardProfileId: z.uuid().optional(),
});

// Type exports
export type ProcessInstance = z.infer<typeof processInstanceWithSchemaEncoder>;
export type DecisionProcess = z.infer<typeof decisionProcessWithSchemaEncoder>;
export type DecisionProfile = z.infer<typeof decisionProfileWithSchemaEncoder>;
export type DecisionProfileList = z.infer<
  typeof decisionProfileWithSchemaListEncoder
>;
export type PhaseRules = z.infer<typeof phaseRulesEncoder>;
export type PhaseDefinition = z.infer<typeof phaseDefinitionEncoder>;
export type InstancePhaseData = z.infer<typeof instancePhaseDataEncoder>;
export type InstanceData = z.infer<typeof instanceDataWithSchemaEncoder>;

// Re-export shared types from @op/common so consumers can import from either package
export type { Proposal, ProposalList } from '@op/common/client';

// Legacy type exports (for backwards compatibility during migration)
export type LegacyDecisionProfile = z.infer<typeof decisionProfileEncoder>;
export type LegacyDecisionProfileList = z.infer<
  typeof decisionProfileListEncoder
>;

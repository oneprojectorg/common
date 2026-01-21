import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  decisions,
  processInstances,
  proposalAttachments,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { attachmentWithUrlEncoder } from './attachments';
import { baseProfileEncoder } from './profiles';

// JSON Schema types
const jsonSchemaEncoder = z.record(z.string(), z.unknown());

// ============================================================================
// DecisionSchemaDefinition format encoders
// ============================================================================

/** Phase behavior rules */
const phaseRulesEncoder = z.object({
  proposals: z
    .object({
      submit: z.boolean().optional(),
      edit: z.boolean().optional(),
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
  rules: phaseRulesEncoder,
  selectionPipeline: selectionPipelineEncoder.optional(),
  settings: jsonSchemaEncoder.optional(),
  // Instance-specific dates (merged from instanceData.phases)
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/** Process-level configuration */
const processConfigEncoder = z.object({
  hideBudget: z.boolean().optional(),
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

/** List encoder for decision processes with new schema format */
export const decisionProcessWithSchemaListEncoder = z.object({
  processes: z.array(decisionProcessWithSchemaEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

/** Instance data encoder for new schema format */
const instanceDataWithSchemaEncoder = z.object({
  budget: z.number().optional(),
  hideBudget: z.boolean().optional(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  currentPhaseId: z.string(),
  stateData: z
    .record(
      z.string(),
      z.object({
        enteredAt: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
  phases: z
    .array(
      z.object({
        phaseId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        rules: z.unknown().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

/** Process instance encoder  */
export const processInstanceWithSchemaEncoder = createSelectSchema(
  processInstances,
)
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
    instanceData: instanceDataWithSchemaEncoder,
    process: decisionProcessWithSchemaEncoder.optional(),
    owner: baseProfileEncoder.optional(),
    proposalCount: z.number().optional(),
    participantCount: z.number().optional(),
  });

/** Decision profile encoder  */
export const decisionProfileWithSchemaEncoder = baseProfileEncoder.extend({
  processInstance: processInstanceWithSchemaEncoder,
});

/** Decision profile list encoder  */
export const decisionProfileWithSchemaListEncoder = z.object({
  items: z.array(decisionProfileWithSchemaEncoder),
  next: z.string().nullish(),
  hasMore: z.boolean(),
});

/** Decision profile filter schema */
export const decisionProfileWithSchemaFilterSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(100).prefault(10),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).prefault('updatedAt'),
  dir: z.enum(['asc', 'desc']).prefault('desc'),
  search: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  ownerProfileId: z.uuid().optional(),
});

// ============================================================================
// Legacy format encoders (for backwards compatibility)
// ============================================================================

// Shared process phase schema
export const processPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  phase: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      sortOrder: z.number().optional(),
    })
    .optional(),
  type: z.enum(['initial', 'intermediate', 'final']).optional(),
});

// Process Schema Encoder
const processSchemaEncoder = z.object({
  name: z.string(),
  description: z.string().optional(),
  budget: z.number().optional(),
  fields: jsonSchemaEncoder.optional(),
  states: z.array(
    processPhaseSchema.extend({
      fields: jsonSchemaEncoder.optional(),
      config: z
        .object({
          allowProposals: z.boolean().optional(),
          allowDecisions: z.boolean().optional(),
          visibleComponents: z.array(z.string()).optional(),
        })
        .optional(),
    }),
  ),
  transitions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      from: z.union([z.string(), z.array(z.string())]),
      to: z.string(),
      rules: z
        .object({
          type: z.enum(['manual', 'automatic']),
          conditions: z
            .array(
              z.object({
                type: z.enum([
                  'time',
                  'proposalCount',
                  'participationCount',
                  'approvalRate',
                  'customField',
                ]),
                operator: z.enum([
                  'equals',
                  'greaterThan',
                  'lessThan',
                  'between',
                ]),
                value: z.unknown().optional(),
                field: z.string().optional(),
              }),
            )
            .optional(),
          requireAll: z.boolean().optional(),
        })
        .optional(),
      actions: z
        .array(
          z.object({
            type: z.enum(['notify', 'updateField', 'createRecord']),
            config: z.record(z.string(), z.unknown()),
          }),
        )
        .optional(),
    }),
  ),
  initialState: z.string(),
  decisionDefinition: jsonSchemaEncoder,
  proposalTemplate: jsonSchemaEncoder,
});

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
      currentPhaseId: obj.currentPhaseId ?? obj.currentStateId,
      phases,
    };
  },
  z.object({
    budget: z.number().optional(),
    hideBudget: z.boolean().optional(),
    fieldValues: z.record(z.string(), z.unknown()).optional(),
    currentPhaseId: z.string(),
    stateData: z
      .record(
        z.string(),
        z.object({
          enteredAt: z.string().optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
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

// Proposal Attachment Join Table Encoder
export const proposalAttachmentEncoder = createSelectSchema(proposalAttachments)
  .pick({
    id: true,
    proposalId: true,
    attachmentId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    attachment: attachmentWithUrlEncoder.optional(),
    uploader: baseProfileEncoder.optional(),
  });

/**
 * Document content discriminated union.
 * - `json`: TipTap document fetched from collaboration service
 * - `html`: Legacy HTML/plain text description from proposalData
 */
const documentContentEncoder = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('json'),
    content: z.array(z.unknown()),
  }),
  z.object({
    type: z.literal('html'),
    content: z.string(),
  }),
]);

export type DocumentContent = z.infer<typeof documentContentEncoder>;

/** Proposal encoder (frontend gets instance data separately via getDecisionBySlug) */
export const proposalEncoder = createSelectSchema(proposals)
  .pick({
    id: true,
    processInstanceId: true,
    proposalData: true,
    status: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
    profileId: true,
  })
  .extend({
    proposalData: z.unknown(),
    submittedBy: baseProfileEncoder.optional(),
    profile: baseProfileEncoder.optional(),
    decisionCount: z.number().optional(),
    likesCount: z.number().optional(),
    followersCount: z.number().optional(),
    commentsCount: z.number().optional(),
    isLikedByUser: z.boolean().optional(),
    isFollowedByUser: z.boolean().optional(),
    isEditable: z.boolean().optional(),
    attachments: z.array(proposalAttachmentEncoder).optional(),
    selectionRank: z.number().nullable().optional(),
    voteCount: z.number().optional(),
    allocated: z.string().nullable().optional(),
    documentContent: documentContentEncoder.optional(),
  });

/** Proposal list encoder */
export const proposalListEncoder = z.object({
  proposals: z.array(proposalEncoder),
  total: z.number(),
  hasMore: z.boolean(),
  canManageProposals: z.boolean().prefault(false),
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
    proposal: proposalEncoder.optional(),
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
  items: z.array(proposalEncoder),
  next: z.string().nullish(),
  hasMore: z.boolean(),
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
  description: z.string().optional(),
  phases: z
    .array(
      z.object({
        phaseId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export const updateDecisionInstanceInputSchema = z.object({
  instanceId: z.uuid(),
  name: z.string().min(3).max(256).optional(),
  description: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  /** Process-level configuration (e.g., hideBudget) */
  config: z
    .object({
      hideBudget: z.boolean().optional(),
    })
    .optional(),
  /** Phase overrides for dates and settings */
  phases: z
    .array(
      z.object({
        phaseId: z.string(),
        startDate: z.string().datetime({ offset: true }).optional(),
        endDate: z.string().datetime({ offset: true }).optional(),
        /** Phase-specific settings (e.g., budget, maxProposalsPerMember, maxVotesPerMember) */
        settings: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
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
    visibility: z.enum(Visibility).optional(),
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
    ownerProfileId: z.uuid(),
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
    proposalIds: z.array(z.uuid()).optional(),
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
  hasMore: z.boolean(),
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
});

// Type exports
export type ProcessInstance = z.infer<typeof processInstanceWithSchemaEncoder>;
export type DecisionProcess = z.infer<typeof decisionProcessWithSchemaEncoder>;
export type DecisionProfile = z.infer<typeof decisionProfileWithSchemaEncoder>;
export type DecisionProfileList = z.infer<
  typeof decisionProfileWithSchemaListEncoder
>;

// Legacy type exports (for backwards compatibility during migration)
export type LegacyDecisionProfile = z.infer<typeof decisionProfileEncoder>;
export type LegacyDecisionProfileList = z.infer<
  typeof decisionProfileListEncoder
>;

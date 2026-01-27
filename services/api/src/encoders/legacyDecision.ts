import { proposalDataSchema } from '@op/common';
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

// Shared process phase schema (legacy state-based format)
export const legacyProcessPhaseSchema = z.object({
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

// Legacy Process Schema Encoder (state-based format)
const legacyProcessSchemaEncoder = z.object({
  name: z.string(),
  description: z.string().optional(),
  budget: z.number().optional(),
  fields: jsonSchemaEncoder.optional(),
  states: z.array(
    legacyProcessPhaseSchema.extend({
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

// Instance Data Encoder (updated to use phaseId format, with fallback from legacy field names)
const legacyInstanceDataEncoder = z.preprocess(
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
export const legacyDecisionProcessEncoder = createSelectSchema(
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
    processSchema: legacyProcessSchemaEncoder,
    createdBy: baseProfileEncoder.optional(),
  });

// Process Instance Encoder
export const legacyProcessInstanceEncoder = createSelectSchema(processInstances)
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
    instanceData: legacyInstanceDataEncoder,
    process: legacyDecisionProcessEncoder.optional(),
    owner: baseProfileEncoder.optional(),
    proposalCount: z.number().optional(),
    participantCount: z.number().optional(),
  });

// Proposal Attachment Join Table Encoder
export const legacyProposalAttachmentEncoder = createSelectSchema(
  proposalAttachments,
)
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

// Proposal Encoder
export const legacyProposalEncoder = createSelectSchema(proposals)
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
    proposalData: proposalDataSchema,
    processInstance: legacyProcessInstanceEncoder.optional(),
    submittedBy: baseProfileEncoder.optional(),
    profile: baseProfileEncoder.optional(),
    decisionCount: z.number().optional(),
    likesCount: z.number().optional(),
    followersCount: z.number().optional(),
    commentsCount: z.number().optional(),
    // User relationship status
    isLikedByUser: z.boolean().optional(),
    isFollowedByUser: z.boolean().optional(),
    // User permissions
    isEditable: z.boolean().optional(),
    // Attachments
    attachments: z.array(legacyProposalAttachmentEncoder).optional(),
    // Selection rank (for results)
    selectionRank: z.number().nullable().optional(),
    // Vote count (for results)
    voteCount: z.number().optional(),
    // Allocated amount (for results)
    allocated: z.string().nullable().optional(),
  });

// Decision Encoder
export const legacyDecisionEncoder = createSelectSchema(decisions)
  .pick({
    id: true,
    decisionData: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    proposal: legacyProposalEncoder.optional(),
    decidedBy: baseProfileEncoder.optional(),
  });

// State Transition History Encoder
export const legacyStateTransitionHistoryEncoder = createSelectSchema(
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
export const legacyDecisionProcessListEncoder = z.object({
  processes: z.array(legacyDecisionProcessEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const legacyProcessInstanceListEncoder = z.object({
  instances: z.array(legacyProcessInstanceEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const legacyProposalListEncoder = z.object({
  proposals: z.array(legacyProposalEncoder),
  total: z.number(),
  hasMore: z.boolean(),
  canManageProposals: z.boolean().prefault(false),
});

export const legacyInstanceResultsEncoder = z.object({
  items: z.array(legacyProposalEncoder),
  next: z.string().nullish(),
  hasMore: z.boolean(),
});

export const legacyDecisionListEncoder = z.object({
  decisions: z.array(legacyDecisionEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

// Input Schemas
export const legacyCreateProcessInputSchema = z.object({
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  processSchema: legacyProcessSchemaEncoder,
});

export const legacyUpdateProcessInputSchema =
  legacyCreateProcessInputSchema.partial();

export const legacyCreateInstanceInputSchema = z.object({
  processId: z.uuid(),
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  instanceData: legacyInstanceDataEncoder,
});

export const legacyUpdateInstanceInputSchema = legacyCreateInstanceInputSchema
  .omit({ processId: true })
  .partial()
  .extend({
    instanceId: z.uuid(),
    status: z.enum(ProcessStatus).optional(),
  });

export const legacyGetInstanceInputSchema = z.object({
  instanceId: z.uuid(),
});

export const legacyCreateProposalInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalData: z.record(z.string(), z.unknown()),
  attachmentIds: z.array(z.string()).optional(), // Array of attachment IDs to link to this proposal
});

export const legacyUpdateProposalInputSchema = legacyCreateProposalInputSchema
  .omit({ processInstanceId: true })
  .partial()
  .extend({
    visibility: z.enum(Visibility).optional(),
    status: z.enum(ProposalStatus).optional(),
  });

export const legacySubmitDecisionInputSchema = z.object({
  proposalId: z.uuid(),
  decisionData: z.record(z.string(), z.unknown()), // Decision data matching voting definition
});

// Transition Schemas
export const legacyExecuteTransitionInputSchema = z.object({
  instanceId: z.uuid(),
  toStateId: z.string(),
  transitionData: z.record(z.string(), z.unknown()).optional(),
});

export const legacyCheckTransitionInputSchema = z.object({
  instanceId: z.uuid(),
  toStateId: z.string().optional(), // If not provided, check all possible transitions
});

export const legacyTransitionCheckResultEncoder = z.object({
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
export const legacyPaginationInputSchema = z.object({
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
});

// Filter Schemas
export const legacyProcessFilterSchema = z
  .object({
    createdByProfileId: z.uuid().optional(),
    search: z.string().optional(),
  })
  .extend(legacyPaginationInputSchema.shape);

export const legacyInstanceFilterSchema = z
  .object({
    processId: z.uuid().optional(),
    ownerProfileId: z.uuid(),
    status: z.enum(ProcessStatus).optional(),
    search: z.string().optional(),
  })
  .extend(legacyPaginationInputSchema.shape);

export const legacyProposalFilterSchema = z
  .object({
    processInstanceId: z.uuid(),
    submittedByProfileId: z.uuid().optional(),
    status: z.enum(ProposalStatus).optional(),
    categoryId: z.string().optional(),
    dir: z.enum(['asc', 'desc']).optional(),
    proposalIds: z.array(z.uuid()).optional(),
  })
  .extend(legacyPaginationInputSchema.shape);

// Decision Profile Encoder (profile with processInstance)
export const legacyDecisionProfileEncoder = baseProfileEncoder.extend({
  processInstance: legacyProcessInstanceEncoder,
});

// Decision Profile List Encoder
export const legacyDecisionProfileListEncoder = z.object({
  items: z.array(legacyDecisionProfileEncoder),
  next: z.string().nullish(),
  hasMore: z.boolean(),
});

// Decision Profile Filter Schema
export const legacyDecisionProfileFilterSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(100).prefault(10),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).prefault('updatedAt'),
  dir: z.enum(['asc', 'desc']).prefault('desc'),
  search: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  ownerProfileId: z.uuid().optional(),
});

// Type exports
export type LegacyDecisionProfile = z.infer<
  typeof legacyDecisionProfileEncoder
>;
export type LegacyDecisionProfileList = z.infer<
  typeof legacyDecisionProfileListEncoder
>;

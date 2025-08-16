import {
  decisionProcesses,
  decisions,
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './profiles';

// JSON Schema types
const jsonSchemaEncoder = z.record(z.unknown());

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
            config: z.record(z.unknown()),
          }),
        )
        .optional(),
    }),
  ),
  initialState: z.string(),
  decisionDefinition: jsonSchemaEncoder,
  proposalTemplate: jsonSchemaEncoder,
});

// Instance Data Encoder
const instanceDataEncoder = z.object({
  budget: z.number().optional(),
  fieldValues: z.record(z.unknown()).optional(),
  currentStateId: z.string(),
  stateData: z
    .record(
      z.object({
        enteredAt: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  phases: z
    .array(
      z.object({
        stateId: z.string(),
        actualStartDate: z.string().optional(),
        actualEndDate: z.string().optional(),
        plannedStartDate: z.string().optional(),
        plannedEndDate: z.string().optional(),
      }),
    )
    .optional(),
});

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

// Proposal Encoder
export const proposalEncoder = createSelectSchema(proposals)
  .pick({
    id: true,
    proposalData: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    profileId: true,
  })
  .extend({
    proposalData: z.unknown(), // Keep as unknown to match database schema
    processInstance: processInstanceEncoder.optional(),
    submittedBy: baseProfileEncoder.optional(),
    profile: baseProfileEncoder.optional(),
    decisionCount: z.number().optional(),
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

export const proposalListEncoder = z.object({
  proposals: z.array(proposalEncoder),
  total: z.number(),
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
  processId: z.string().uuid(),
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  instanceData: instanceDataEncoder,
});

export const updateInstanceInputSchema = createInstanceInputSchema
  .omit({ processId: true })
  .partial()
  .extend({
    instanceId: z.string().uuid(),
    status: z
      .enum(['draft', 'active', 'paused', 'completed', 'cancelled'])
      .optional(),
  });

export const getInstanceInputSchema = z.object({
  instanceId: z.string().uuid(),
});

export const createProposalInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  proposalData: z.record(z.unknown()), // Proposal content matching template
});

export const updateProposalInputSchema = createProposalInputSchema
  .omit({ processInstanceId: true })
  .partial();

export const submitDecisionInputSchema = z.object({
  proposalId: z.string().uuid(),
  decisionData: z.record(z.unknown()), // Decision data matching voting definition
});

// Transition Schemas
export const executeTransitionInputSchema = z.object({
  instanceId: z.string().uuid(),
  toStateId: z.string(),
  transitionData: z.record(z.unknown()).optional(),
});

export const checkTransitionInputSchema = z.object({
  instanceId: z.string().uuid(),
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
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Filter Schemas
export const processFilterSchema = z
  .object({
    createdByProfileId: z.string().uuid().optional(),
    search: z.string().optional(),
  })
  .merge(paginationInputSchema);

export const instanceFilterSchema = z
  .object({
    processId: z.string().uuid().optional(),
    ownerProfileId: z.string().uuid().optional(),
    status: z
      .enum(['draft', 'active', 'paused', 'completed', 'cancelled'])
      .optional(),
    search: z.string().optional(),
  })
  .merge(paginationInputSchema);

export const proposalFilterSchema = z
  .object({
    processInstanceId: z.string().uuid().optional(),
    submittedByProfileId: z.string().uuid().optional(),
    status: z
      .enum(['draft', 'submitted', 'under_review', 'approved', 'rejected'])
      .optional(),
  })
  .merge(paginationInputSchema);

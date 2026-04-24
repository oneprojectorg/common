import { documentContentSchema, proposalDataSchema } from '@op/common/client';
import {
  ProcessStatus,
  decisionProcesses,
  processInstances,
  proposalAttachments,
  proposals,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { attachmentWithUrlEncoder } from './attachments';
import { baseProfileEncoder } from './profiles';

// JSON Schema types
const jsonSchemaEncoder = z.record(z.string(), z.unknown());

// Shared process phase schema (legacy state-based format)
const legacyProcessPhaseSchema = z.object({
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

// Proposal Attachment Join Table Encoder (internal — used by legacyProposalEncoder)
const legacyProposalAttachmentEncoder = createSelectSchema(proposalAttachments)
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

// Proposal Encoder (internal — used by legacyInstanceResultsEncoder)
const legacyProposalEncoder = createSelectSchema(proposals)
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
    profile: baseProfileEncoder,
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
    // Document content (TipTap JSON or legacy HTML)
    documentContent: documentContentSchema.optional(),
  });

// List Encoders (for paginated responses)
export const legacyProcessInstanceListEncoder = z.object({
  instances: z.array(legacyProcessInstanceEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const legacyInstanceResultsEncoder = z.object({
  items: z.array(legacyProposalEncoder),
  next: z.string().nullish(),
});

// Input Schemas
export const legacyCreateProcessInputSchema = z.object({
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  processSchema: legacyProcessSchemaEncoder,
});

export const legacyGetInstanceInputSchema = z.object({
  instanceId: z.uuid(),
});

// Pagination Schema (internal — used by legacyInstanceFilterSchema)
const legacyPaginationInputSchema = z.object({
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
});

// Filter Schemas
export const legacyInstanceFilterSchema = z
  .object({
    processId: z.uuid().optional(),
    ownerProfileId: z.uuid().optional(),
    stewardProfileId: z.uuid().optional(),
    status: z.enum(ProcessStatus).optional(),
    search: z.string().optional(),
  })
  .extend(legacyPaginationInputSchema.shape);

export const legacyOnlyInstanceFilterSchema = z.object({
  ownerProfileId: z.uuid(),
});

export const legacyInstanceListEncoder = z.array(legacyProcessInstanceEncoder);

// Type exports
export type LegacyProcessInstance = z.infer<
  typeof legacyProcessInstanceEncoder
>;

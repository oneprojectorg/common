/**
 * Decision Encoders
 *
 * These encoders are for the DecisionSchemaDefinition format.
 * Instances use phases and phaseId.
 */
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  decisions,
  processInstances,
  proposalAttachments,
  proposals,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { attachmentWithUrlEncoder } from './attachments';
import { baseProfileEncoder } from './profiles';

// =============================================================================
// Process Schema (DecisionSchemaDefinition)
// =============================================================================

export const phaseRulesEncoder = z.object({
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
      start: z.string().optional(),
    })
    .optional(),
});

export const phaseDefinitionEncoder = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rules: phaseRulesEncoder,
  selectionPipeline: z.unknown().optional(),
  settings: z.unknown().optional(),
});

export const processSchemaEncoder = z.object({
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: z
    .object({
      hideBudget: z.boolean().optional(),
    })
    .optional(),
  phases: z.array(phaseDefinitionEncoder),
});

// =============================================================================
// Instance Data
// =============================================================================

// Instance Data Encoder that supports both new and legacy field names
export const instanceDataEncoder = z.preprocess(
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
    config: z
      .object({
        hideBudget: z.boolean().optional(),
      })
      .optional(),
    phases: z
      .array(
        z.object({
          phaseId: z.string(),
          rules: phaseRulesEncoder.optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          settings: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
  }),
);

// =============================================================================
// Main Encoders
// =============================================================================

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

// Proposal Attachment Encoder
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

// Proposal Encoder
export const proposalEncoder = createSelectSchema(proposals)
  .pick({
    id: true,
    proposalData: true,
    status: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
    profileId: true,
  })
  .extend({
    proposalData: z.unknown(),
    processInstance: processInstanceEncoder.optional(),
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

// =============================================================================
// List Encoders
// =============================================================================

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
  canManageProposals: z.boolean().prefault(false),
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

// =============================================================================
// Input Schemas
// =============================================================================

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

export const updateInstanceInputSchema = z.object({
  instanceId: z.uuid(),
  name: z.string().min(3).max(256).optional(),
  description: z.string().optional(),
  instanceData: instanceDataEncoder.partial().optional(),
  status: z.enum(ProcessStatus).optional(),
});

export const createProposalInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalData: z.record(z.string(), z.unknown()),
  attachmentIds: z.array(z.string()).optional(),
});

export const updateProposalInputSchema = createProposalInputSchema
  .omit({ processInstanceId: true })
  .partial()
  .extend({
    visibility: z.enum(Visibility).optional(),
  });

export const submitDecisionInputSchema = z.object({
  proposalId: z.uuid(),
  decisionData: z.record(z.string(), z.unknown()),
});

// =============================================================================
// Pagination and Filter Schemas
// =============================================================================

export const paginationInputSchema = z.object({
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
});

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

// =============================================================================
// Type Exports
// =============================================================================

export type ProcessSchema = z.infer<typeof processSchemaEncoder>;
export type InstanceData = z.infer<typeof instanceDataEncoder>;
export type PhaseDefinition = z.infer<typeof phaseDefinitionEncoder>;
export type PhaseRules = z.infer<typeof phaseRulesEncoder>;

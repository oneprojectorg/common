/**
 * Decision Encoders
 *
 * These encoders are for the new DecisionSchemaDefinition format.
 * New instances use phases (not states) and phaseId (not stateId).
 *
 * Legacy format (states, stateId) is in legacyDecision.ts
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

export const processSchemaNewEncoder = z.object({
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

export const instanceDataNewEncoder = z.object({
  budget: z.number().optional(),
  hideBudget: z.boolean().optional(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  currentPhaseId: z.string(),
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
        plannedStartDate: z.string().optional(),
        plannedEndDate: z.string().optional(),
      }),
    )
    .optional(),
});

// =============================================================================
// Main Encoders
// =============================================================================

// Decision Process Encoder
export const decisionProcessNewEncoder = createSelectSchema(decisionProcesses)
  .pick({
    id: true,
    name: true,
    description: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    processSchema: processSchemaNewEncoder,
    createdBy: baseProfileEncoder.optional(),
  });

// Process Instance Encoder
export const processInstanceNewEncoder = createSelectSchema(processInstances)
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
    instanceData: instanceDataNewEncoder,
    process: decisionProcessNewEncoder.optional(),
    owner: baseProfileEncoder.optional(),
    proposalCount: z.number().optional(),
    participantCount: z.number().optional(),
  });

// Proposal Attachment Encoder
export const proposalAttachmentNewEncoder = createSelectSchema(
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
export const proposalNewEncoder = createSelectSchema(proposals)
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
    processInstance: processInstanceNewEncoder.optional(),
    submittedBy: baseProfileEncoder.optional(),
    profile: baseProfileEncoder.optional(),
    decisionCount: z.number().optional(),
    likesCount: z.number().optional(),
    followersCount: z.number().optional(),
    commentsCount: z.number().optional(),
    isLikedByUser: z.boolean().optional(),
    isFollowedByUser: z.boolean().optional(),
    isEditable: z.boolean().optional(),
    attachments: z.array(proposalAttachmentNewEncoder).optional(),
    selectionRank: z.number().nullable().optional(),
    voteCount: z.number().optional(),
    allocated: z.string().nullable().optional(),
  });

// Decision Encoder
export const decisionNewEncoder = createSelectSchema(decisions)
  .pick({
    id: true,
    decisionData: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    proposal: proposalNewEncoder.optional(),
    decidedBy: baseProfileEncoder.optional(),
  });

// =============================================================================
// List Encoders
// =============================================================================

export const decisionProcessListNewEncoder = z.object({
  processes: z.array(decisionProcessNewEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const processInstanceListNewEncoder = z.object({
  instances: z.array(processInstanceNewEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

export const proposalListNewEncoder = z.object({
  proposals: z.array(proposalNewEncoder),
  total: z.number(),
  hasMore: z.boolean(),
  canManageProposals: z.boolean().prefault(false),
});

export const instanceResultsNewEncoder = z.object({
  items: z.array(proposalNewEncoder),
  next: z.string().nullish(),
  hasMore: z.boolean(),
});

export const decisionListNewEncoder = z.object({
  decisions: z.array(decisionNewEncoder),
  total: z.number(),
  hasMore: z.boolean(),
});

// =============================================================================
// Input Schemas
// =============================================================================

export const createInstanceFromTemplateInputSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(3).max(256),
  description: z.string().optional(),
  budget: z.number().optional(),
  phases: z
    .array(
      z.object({
        phaseId: z.string(),
        plannedStartDate: z.string().optional(),
        plannedEndDate: z.string().optional(),
      }),
    )
    .optional(),
});

export const updateInstanceNewInputSchema = z.object({
  instanceId: z.uuid(),
  name: z.string().min(3).max(256).optional(),
  description: z.string().optional(),
  instanceData: instanceDataNewEncoder.partial().optional(),
  status: z.enum(ProcessStatus).optional(),
});

export const createProposalNewInputSchema = z.object({
  processInstanceId: z.uuid(),
  proposalData: z.record(z.string(), z.unknown()),
  attachmentIds: z.array(z.string()).optional(),
});

export const updateProposalNewInputSchema = createProposalNewInputSchema
  .omit({ processInstanceId: true })
  .partial()
  .extend({
    visibility: z.enum(Visibility).optional(),
  });

export const submitDecisionNewInputSchema = z.object({
  proposalId: z.uuid(),
  decisionData: z.record(z.string(), z.unknown()),
});

// =============================================================================
// Pagination and Filter Schemas
// =============================================================================

export const paginationNewInputSchema = z.object({
  limit: z.number().min(1).max(100).prefault(20),
  offset: z.number().min(0).prefault(0),
});

export const instanceFilterNewSchema = z
  .object({
    processId: z.uuid().optional(),
    ownerProfileId: z.uuid(),
    status: z.enum(ProcessStatus).optional(),
    search: z.string().optional(),
  })
  .extend(paginationNewInputSchema.shape);

export const proposalFilterNewSchema = z
  .object({
    processInstanceId: z.uuid(),
    submittedByProfileId: z.uuid().optional(),
    status: z.enum(ProposalStatus).optional(),
    categoryId: z.string().optional(),
    dir: z.enum(['asc', 'desc']).optional(),
    proposalIds: z.array(z.uuid()).optional(),
  })
  .extend(paginationNewInputSchema.shape);

// Decision Profile Encoder (profile with processInstance)
export const decisionProfileNewEncoder = baseProfileEncoder.extend({
  processInstance: processInstanceNewEncoder,
});

// Decision Profile List Encoder
export const decisionProfileListNewEncoder = z.object({
  items: z.array(decisionProfileNewEncoder),
  next: z.string().nullish(),
  hasMore: z.boolean(),
});

// Decision Profile Filter Schema
export const decisionProfileFilterNewSchema = z.object({
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

export type DecisionProfileNew = z.infer<typeof decisionProfileNewEncoder>;
export type DecisionProfileListNew = z.infer<
  typeof decisionProfileListNewEncoder
>;
export type ProcessInstanceNew = z.infer<typeof processInstanceNewEncoder>;
export type ProcessSchemaNew = z.infer<typeof processSchemaNewEncoder>;
export type InstanceDataNew = z.infer<typeof instanceDataNewEncoder>;
export type DecisionProcessNew = z.infer<typeof decisionProcessNewEncoder>;
export type ProposalNew = z.infer<typeof proposalNewEncoder>;
export type DecisionNew = z.infer<typeof decisionNewEncoder>;
export type ProposalAttachmentNew = z.infer<typeof proposalAttachmentNewEncoder>;
export type PhaseDefinitionNew = z.infer<typeof phaseDefinitionEncoder>;
export type PhaseRulesNew = z.infer<typeof phaseRulesEncoder>;

// =============================================================================
// Backwards Compatibility Re-exports
// These re-export legacy encoders with old names for existing code
// TODO: Remove after frontend migration to new encoders
// =============================================================================

export {
  legacyDecisionProfileEncoder as decisionProfileEncoder,
  legacyDecisionProfileListEncoder as decisionProfileListEncoder,
  legacyProcessPhaseSchema as processPhaseSchema,
  legacyProposalEncoder as proposalEncoder,
  legacyDecisionProcessEncoder as decisionProcessEncoder,
  legacyProcessInstanceEncoder as processInstanceEncoder,
  type LegacyDecisionProfile as DecisionProfile,
  type LegacyDecisionProfileList as DecisionProfileList,
} from './legacyDecision';

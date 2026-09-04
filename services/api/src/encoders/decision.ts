import {
  PAGE_LIMIT,
  proposalSearchSchema,
  PROPOSAL_TITLE_MAX_LENGTH,
  REVIEWS_POLICIES,
  checkpointVersionSchema,
  instanceOptionalPhaseRefSchema,
  phaseReviewSettingsSchema,
  proposalSchema,
  rubricTemplateSchema,
} from '@op/common/client';
import type { JSONContent } from '@op/common/client';
import type { PhaseRules as CommonPhaseRules } from '@op/common/src/services/decision';
import {
  ProcessStatus,
  ProfileRelationshipType,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './profiles';

// JSON Schema types
const jsonSchemaEncoder = z.record(z.string(), z.unknown());

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
      defaults: z
        .object({
          hidden: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  voting: z
    .object({
      submit: z.boolean().optional(),
      edit: z.boolean().optional(),
      maxVotesPerMember: z.number().int().positive().optional(),
    })
    .optional(),
  advancement: z
    .object({
      method: z.enum(['date', 'manual']),
      endDate: z.string().optional(),
    })
    .optional(),
  reviews: phaseReviewSettingsSchema.optional(),
}) satisfies z.ZodType<CommonPhaseRules>;

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
  // Phase-specific rubric (overrides the schema-level rubricTemplate)
  rubricTemplate: rubricTemplateSchema.optional(),
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
  rubricTemplate: rubricTemplateSchema.optional(),
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

/**
 * A stored headline, read back. Writes reject an empty title, so a blank value
 * here is a row from before that: decode it as absent, and the fallback chains
 * that render it (`currentPhase?.headline ?? t('...')`) take the default copy
 * instead of rendering a blank heading.
 */
const storedHeadlineEncoder = z
  .string()
  .transform((headline) => (headline.trim() ? headline : undefined))
  .optional();

/**
 * A headline on the way in. An empty (or whitespace-only) title is not valid
 * content, so it is rejected rather than coerced. `null` is how a caller says
 * "clear this headline" — the stored value is deleted and the page falls back
 * to its default copy — and `undefined` leaves it unchanged.
 */
const nonBlankHeadline = z.string().trim().min(1, 'Headline cannot be empty');

const phaseHeadlineInputEncoder = nonBlankHeadline.nullable().optional();

/** Capped at the length the overview editor's character counter enforces. */
const overviewHeadlineInputEncoder = nonBlankHeadline
  .max(50)
  .nullable()
  .optional();

/** Instance-specific phase data (overrides for dates, rules, settings) */
export const instancePhaseDataEncoder = z.object({
  phaseId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  headline: storedHeadlineEncoder,
  additionalInfo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rules: phaseRulesEncoder.optional(),
  selectionPipeline: selectionPipelineEncoder.optional(),
  settingsSchema: jsonSchemaEncoder.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  // Phase-specific rubric; resolve via getPhaseRubricTemplate (instance-level
  // rubricTemplate is the fallback)
  rubricTemplate: rubricTemplateSchema.optional(),
});

/**
 * Generous size budget (string length / serialized JSON length) for the
 * overview body, applied on writes only. Large
 * because images are currently inlined as base64 (editor feature behind a flag,
 * internal testing only) — a single image easily exceeds tens of KB. Tighten it
 * once images move to the app-wide upload→URL flow.
 */
const MAX_OVERVIEW_BODY_SIZE = 5_000_000;

/**
 * A stored TipTap JSON doc — a `doc`-rooted object (what `editor.getJSON()`
 * always produces). Requiring `type === 'doc'` rejects arbitrary objects at the
 * write boundary, so a misrouted value can't silently store and then render
 * blank; on read, a non-doc object degrades via the body's `.catch(undefined)`.
 */
const isRichTextDoc = (val: unknown): val is JSONContent =>
  typeof val === 'object' &&
  val !== null &&
  !Array.isArray(val) &&
  'type' in val &&
  val.type === 'doc';

/**
 * Rich text body. New content is a TipTap JSON doc; legacy rows hold an HTML
 * string until backfilled. Both shapes are accepted on read and write.
 */
const overviewBodyEncoder = z.union([
  z.string(),
  z.custom<JSONContent>(isRichTextDoc),
]);

const overviewBodyInputEncoder = z.union([
  z.string().max(MAX_OVERVIEW_BODY_SIZE),
  z
    .custom<JSONContent>(isRichTextDoc)
    .refine(
      (doc) => JSON.stringify(doc).length <= MAX_OVERVIEW_BODY_SIZE,
      'Overview body is too large',
    ),
]);

/**
 * Public-facing overview content (headline, short description, rich text body).
 *
 * Output encoder: permissive (no length caps) so already-stored rows always
 * read back — a cap here, combined with the `.catch(undefined)` on the read
 * path, would silently drop the entire overview if any field were over-length.
 * Length is enforced only on the input encoder below.
 */
const instanceOverviewEncoder = z.object({
  headline: storedHeadlineEncoder,
  description: z.string().optional(),
  // Scope the read-path degradation to `body` alone: a malformed stored body
  // becomes undefined without taking headline/description down with it.
  body: overviewBodyEncoder.optional().catch(undefined),
  heroImage: z.string().optional(),
});

/**
 * Input encoder: enforces length caps as an abuse/runaway-storage guard on
 * writes.
 */
const instanceOverviewInputEncoder = z.object({
  headline: overviewHeadlineInputEncoder,
  description: z.string().max(500).optional(),
  body: overviewBodyInputEncoder.optional(),
  // `heroImage` is intentionally NOT accepted here: it's a storage path that
  // must pass the trust-boundary check (prefix/stored-MIME/image-only/size),
  // so it can only be set/cleared via the dedicated updateOverviewHeroImage /
  // removeOverviewHeroImage endpoints. Accepting it on the generic update
  // would let a client persist an arbitrary or foreign path unchecked.
});

/** Instance data encoder for new schema format */
const instanceDataWithSchemaEncoder = z.object({
  config: processConfigEncoder.optional(),
  // Stored rows may hold overview shapes from older builds; degrade to no
  // overview instead of failing the whole instance/list response. The
  // update input schema (below) stays strict.
  overview: instanceOverviewEncoder.optional().catch(undefined),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
  templateId: z.string().optional(),
  templateVersion: z.string().optional(),
  templateName: z.string().optional(),
  templateDescription: z.string().optional(),
  phases: z.array(instancePhaseDataEncoder).optional(),
  proposalTemplate: jsonSchemaEncoder.optional(),
  rubricTemplate: rubricTemplateSchema.optional(),
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
    slug: z.string().nullish(),
    proposalCount: z.number().optional(),
    participantCount: z.number().optional(),
    access: decisionAccessEncoder.optional(),
    selectionsAreConfirmed: z.boolean().optional(),
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
  limit: z.number().min(1).max(PAGE_LIMIT.max).prefault(PAGE_LIMIT.sm),
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
    phases: z.array(instancePhaseDataEncoder).optional(),
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
  // Overrides the read-path encoder: `''` is rejected here rather than decoded
  // as absent, and `null` is the explicit "clear this headline".
  headline: phaseHeadlineInputEncoder,
  // `null` clears the phase-level rubric; omitted leaves it unchanged.
  rubricTemplate: rubricTemplateSchema.nullable().optional(),
});

export const updateDecisionInstanceInputSchema = z.object({
  instanceId: z.uuid(),
  name: z.string().max(256).optional(),
  description: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  stewardProfileId: z.string().uuid().optional(),
  /** Process-level configuration (e.g., hideBudget, categories) */
  config: processConfigEncoder.optional(),
  /** Public-facing overview content (headline, short description, rich text body) */
  overview: instanceOverviewInputEncoder.optional(),
  /** Phase overrides for dates, rules, and settings */
  phases: z.array(instancePhaseDataInputEncoder).optional(),
  /** Proposal template (JSON Schema) */
  proposalTemplate: jsonSchemaEncoder.optional(),
  /** Rubric template (JSON Schema defining evaluation criteria) */
  rubricTemplate: rubricTemplateSchema.optional(),
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

// Shared by decision.addProposalRelationship / removeProposalRelationship —
// proposal engagement is limited to like/follow.
export const proposalRelationshipInputSchema = z.object({
  targetProfileId: z.uuid(),
  relationshipType: z.enum([
    ProfileRelationshipType.FOLLOWING,
    ProfileRelationshipType.LIKES,
  ]),
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
    // The title becomes the proposal profile's name, and `profiles.name` is
    // varchar(256) — past it the insert throws a raw Postgres error on every
    // autosave. The editor caps typing, but a remote collaborator, a version
    // restore, or a direct call to this endpoint doesn't go through it.
    title: z.string().max(PROPOSAL_TITLE_MAX_LENGTH).optional(),
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
  limit: z.number().min(1).max(PAGE_LIMIT.max).prefault(PAGE_LIMIT.md),
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

export const proposalFilterSchema = instanceOptionalPhaseRefSchema.extend({
  submittedByProfileId: z.uuid().optional(),
  status: z.enum(ProposalStatus).optional(),
  categoryId: z.string().optional(),
  search: proposalSearchSchema,
  dir: z.enum(['asc', 'desc']).optional(),
  /**
   * Restrict results to proposals voted on by this profile. Bypasses phase
   * scoping so a user's ballot remains accessible after the process moves
   * past the voting phase.
   */
  votedByProfileId: z.uuid().optional(),
  /**
   * When true, exclude proposals the current user is assigned to review in the
   * viewed phase. Resolved server-side from the request's user context. Powers
   * the reviewer's "Other proposals" tab.
   */
  excludeAssignedForReview: z.boolean().optional(),
  /** When set to 'results', all proposals are returned as non-editable */
  phase: z.enum(['results']).optional(),
  /** Keyset pagination cursor from the previous page's `next`. */
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(PAGE_LIMIT.max).prefault(PAGE_LIMIT.md),
});

/**
 * Input for `decision.listProposalLocations` — the map's pin source. Mirrors
 * `proposalFilterSchema` minus pagination (the endpoint returns every located
 * proposal in scope) so the map applies the same filters as the list.
 */
export const proposalLocationsFilterSchema =
  instanceOptionalPhaseRefSchema.extend({
    submittedByProfileId: z.uuid().optional(),
    status: z.enum(ProposalStatus).optional(),
    categoryId: z.string().optional(),
    search: proposalSearchSchema,
    votedByProfileId: z.uuid().optional(),
    excludeAssignedForReview: z.boolean().optional(),
    phase: z.enum(['results']).optional(),
  });

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
  limit: z.number().min(1).max(PAGE_LIMIT.max).prefault(PAGE_LIMIT.sm),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).prefault('updatedAt'),
  dir: z.enum(['asc', 'desc']).prefault('desc'),
  search: z.string().optional(),
  status: z.enum(ProcessStatus).optional(),
  ownerProfileId: z.uuid().optional(),
  stewardProfileId: z.uuid().optional(),
});

// ============================================================================
// Decision boundary encoders
// ============================================================================

/**
 * GeoJSON MultiPolygon for a persisted decision boundary. Boundaries are stored
 * as `geometry(MultiPolygon, 4326)`, so `ST_AsGeoJSON` always emits a 2D
 * MultiPolygon (no elevation). The schema mirrors that exact shape — any drift
 * in the SQL emitter surfaces at the API boundary, not as a silent client-side
 * render bug.
 */
const boundaryPositionEncoder = z.tuple([z.number(), z.number()]);
const boundaryLinearRingEncoder = z.array(boundaryPositionEncoder);
const boundaryPolygonEncoder = z.array(boundaryLinearRingEncoder);
export const boundaryMultiPolygonEncoder = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(boundaryPolygonEncoder),
});

/** A decision boundary's id, name, linked category term, and GeoJSON geometry. */
export const boundaryShapeEncoder = z.object({
  id: z.string(),
  name: z.string(),
  taxonomyTermId: z.string().nullable(),
  geometry: boundaryMultiPolygonEncoder,
});

export type BoundaryMultiPolygon = z.infer<typeof boundaryMultiPolygonEncoder>;
export type BoundaryShape = z.infer<typeof boundaryShapeEncoder>;

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

import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
  categoryReviewers,
  profiles,
} from '@op/db/schema';
import { logger } from '@op/logging';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import type { RubricTemplateSchema } from '../types';
import {
  instanceOptionalPhaseRefSchema,
  instancePhaseRefSchema,
} from './instance';
import { proposalProfileSchema, proposalSchema } from './proposal';
import {
  type ProposalCategoryItem,
  proposalCategorySchema,
} from './proposalCategory';

export {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
};

/** The sort modes offered by the reviewer's "Proposals to review" list. */
export const REVIEW_ASSIGNMENT_SORTS = [
  'leastReviewed',
  'newest',
  'oldest',
] as const;

export type ReviewAssignmentSort = (typeof REVIEW_ASSIGNMENT_SORTS)[number];

const jsonObjectSchema = z.record(z.string(), z.unknown());

/**
 * Probe schema — not enforced. We log when a rubric drifts from this shape so
 * we hear about bad data without breaking the response.
 */
const rubricTemplateProbe = z
  .object({
    type: z.literal('object'),
    properties: z
      .record(
        z.string(),
        z
          .object({
            type: z.string().optional(),
            'x-format': z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    'x-field-order': z.array(z.string()).optional(),
  })
  .passthrough();

export const rubricTemplateSchema = z
  .custom<RubricTemplateSchema>(
    (val) => typeof val === 'object' && val !== null && !Array.isArray(val),
  )
  .transform((data) => {
    const result = rubricTemplateProbe.safeParse(data);
    if (!result.success) {
      logger.error('rubricTemplate did not match expected shape', {
        issues: result.error.issues,
      });
    }
    return data;
  });

/**
 * Review data is split into two parallel maps keyed by criterion id:
 *   - `answers`: validated against the rubric template
 *   - `rationales`: always-optional free-text notes per criterion
 *
 * Keeping them separate keeps the template clean (no `__rationale` companion
 * keys) and makes the storage shape describe what each half is.
 *
 * Inner defaults tolerate legacy/draft rows stored as `{}` — they parse to
 * `{ answers: {}, rationales: {} }` rather than failing at the boundary.
 */
export const rubricReviewDataSchema = z.object({
  answers: jsonObjectSchema.default({}),
  rationales: z.record(z.string(), z.string()).default({}),
});

export type RubricReviewData = z.infer<typeof rubricReviewDataSchema>;

// ── Review assignment schemas ───────────────────────────────────────────

export const proposalReviewAssignmentSchema = instancePhaseRefSchema.extend({
  id: z.uuid(),
  status: z.enum(ProposalReviewAssignmentStatus),
  proposal: proposalSchema,
});

// ── Revision request schemas ───────────────────────────────────────────

export const proposalReviewRequestSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  state: z.enum(ProposalReviewRequestState),
  requestComment: z.string(),
  responseComment: z.string().nullable(),
  requestedAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

// ── Review schemas ──────────────────────────────────────────────────────

export const proposalReviewSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  state: z.enum(ProposalReviewState),
  reviewData: rubricReviewDataSchema,
  overallComment: z.string().nullable(),
  submittedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const reviewAssignmentExtendedSchema = z.object({
  assignment: proposalReviewAssignmentSchema,
  rubricTemplate: rubricTemplateSchema.nullable(),
  review: proposalReviewSchema.nullable(),
  revisionRequest: proposalReviewRequestSchema.nullable(),
  canEditReview: z.boolean(),
});

export const reviewAssignmentListSchema = z.object({
  assignments: z.array(reviewAssignmentExtendedSchema),
});

// ── Proposal-scoped revision request schemas ──────────────────────────

export const proposalRevisionRequestItemSchema = z.object({
  revisionRequest: proposalReviewRequestSchema,
  proposal: proposalSchema,
  decisionProfileSlug: z.string(),
});

export const proposalRevisionRequestListSchema = z.object({
  revisionRequests: z.array(proposalRevisionRequestItemSchema),
});

// ── Proposal-scoped author feedback schemas ───────────────────────────

/**
 * One anonymized reviewer note released to the proposal author. Deliberately
 * narrower than `proposalReviewSchema`: no `reviewData`, and never a reviewer
 * identity — anonymity is structural, not a runtime setting.
 */
export const proposalFeedbackItemSchema = z.object({
  id: z.uuid(),
  comment: z.string(),
  phaseId: z.string(),
  submittedAt: z.string().nullable(),
});

export const proposalFeedbackListSchema = z.object({
  items: z.array(proposalFeedbackItemSchema),
});

// ── Per-proposal review aggregates ─────────────────────────────────────

/**
 * Per-proposal aggregates derived from review assignments and their submitted
 * reviews.
 *
 * `averageScore` is the mean of per-review scores across submitted reviews
 * (sum of integer rubric criteria, divided by `reviewsSubmittedCount`). Returns
 * 0 when no submissions exist.
 *
 * `overallRecommendationCount` is a tally of submitted answers to the
 * well-known overall-recommendation criterion (e.g. `{ yes: 2, no: 1 }`).
 * Empty when the rubric doesn't include the field or no reviews are in.
 */
export const proposalReviewAggregatesSchema = z.object({
  assignmentsCount: z.number().int(),
  reviewsSubmittedCount: z.number().int(),
  averageScore: z.number(),
  overallRecommendationCount: z.record(z.string(), z.number().int()),
  reviewers: z.array(
    z.object({
      profile: proposalProfileSchema,
      status: z.enum(ProposalReviewAssignmentStatus),
    }),
  ),
});

export const proposalWithAggregatesSchema = z.object({
  proposal: proposalSchema,
  aggregates: proposalReviewAggregatesSchema,
  categories: z.array(proposalCategorySchema),
});

/**
 * Single response shape for both filtered and phase-scoped modes. Neither
 * paginates, so there is no page count or cursor to carry — a caller that
 * wants a count reads `items.length`.
 */
export const proposalsWithReviewAggregatesListSchema = z.object({
  items: z.array(proposalWithAggregatesSchema),
  /** The phase-resolved rubric the items' aggregates were scored against. */
  rubricTemplate: rubricTemplateSchema.nullable(),
});

// ── Single proposal with submitted reviews ─────────────────────────────

/** `score` and `overallRecommendation` are precomputed so clients don't redo the rubric math. */
export const submittedReviewItemSchema = z.object({
  review: proposalReviewSchema,
  reviewer: proposalProfileSchema,
  assignmentStatus: z.enum(ProposalReviewAssignmentStatus),
  score: z.number(),
  overallRecommendation: z.string().nullable(),
});

export const proposalWithSubmittedReviewsSchema =
  proposalWithAggregatesSchema.extend({
    reviews: z.array(submittedReviewItemSchema),
    /** The phase-resolved rubric the returned reviews were scored against. */
    rubricTemplate: rubricTemplateSchema.nullable(),
  });

// ── Instance-level review progress (admin overview header) ─────────────

/**
 * Per-phase review-progress counters (defaults to the current phase).
 *   - proposalsReviewedCount: non-draft proposals with ≥1 COMPLETED assignment.
 *   - activeReviewersCount: distinct reviewers with ≥1 non-PENDING assignment.
 *   - daysLeft: ceil(now → phase endDate); null if no end date or phase.
 */
export const phaseReviewProgressSchema = z.object({
  proposalsReviewedCount: z.number().int(),
  proposalsTotalCount: z.number().int(),
  activeReviewersCount: z.number().int(),
  reviewersTotalCount: z.number().int(),
  daysLeft: z.number().int().nullable(),
});

export type PhaseReviewProgress = z.infer<typeof phaseReviewProgressSchema>;

// ── Types ───────────────────────────────────────────────────────────────

export type ProposalReviewAssignment = z.infer<
  typeof proposalReviewAssignmentSchema
>;
export type ProposalReviewRequest = z.infer<typeof proposalReviewRequestSchema>;
export type ProposalReview = z.infer<typeof proposalReviewSchema>;
export type ReviewAssignmentExtended = z.infer<
  typeof reviewAssignmentExtendedSchema
>;
export type ReviewAssignmentList = z.infer<typeof reviewAssignmentListSchema>;
export type ProposalRevisionRequestItem = z.infer<
  typeof proposalRevisionRequestItemSchema
>;
export type ProposalRevisionRequestList = z.infer<
  typeof proposalRevisionRequestListSchema
>;
export type ProposalFeedbackItem = z.infer<typeof proposalFeedbackItemSchema>;
export type ProposalFeedbackList = z.infer<typeof proposalFeedbackListSchema>;
export type ProposalReviewAggregates = z.infer<
  typeof proposalReviewAggregatesSchema
>;
export { proposalCategorySchema, type ProposalCategoryItem };
export type ProposalWithAggregates = z.infer<
  typeof proposalWithAggregatesSchema
>;
export type ProposalsWithReviewAggregatesList = z.infer<
  typeof proposalsWithReviewAggregatesListSchema
>;
export type SubmittedReviewItem = z.infer<typeof submittedReviewItemSchema>;
export type ProposalWithSubmittedReviews = z.infer<
  typeof proposalWithSubmittedReviewsSchema
>;

// ── Reviews by category (scope layer) ──────────────────────────────────────

/** Category-reviewer scope row returned by the add mutation (no soft-delete column). */
export const categoryReviewerSchema = createSelectSchema(
  categoryReviewers,
).pick({
  id: true,
  processInstanceId: true,
  taxonomyTermId: true,
  reviewerProfileId: true,
  phaseId: true,
  createdAt: true,
  updatedAt: true,
});

export type CategoryReviewerSchema = z.infer<typeof categoryReviewerSchema>;

/** Minimal reviewer profile surfaced in a category card. */
export const categoryReviewerProfileSchema = createSelectSchema(profiles)
  .pick({
    name: true,
    slug: true,
    avatarImageId: true,
  })
  .extend({
    id: z.uuid(),
  });

/** One reviewer entry within a category card. */
export const categoryReviewerEntrySchema = z.object({
  scopeId: z.uuid(),
  reviewerProfileId: z.uuid(),
  phaseId: z.string().nullable(),
  profile: categoryReviewerProfileSchema,
});

/** A category with its (possibly empty) reviewer list. */
export const categoryWithReviewersSchema = z.object({
  category: z.object({
    id: z.string(),
    name: z.string(),
    termUri: z.string(),
  }),
  reviewers: z.array(categoryReviewerEntrySchema),
});

export type CategoryWithReviewersSchema = z.infer<
  typeof categoryWithReviewersSchema
>;

export const categoryReviewersListSchema = z.object({
  categories: z.array(categoryWithReviewersSchema),
});

export const removeCategoryReviewerResultSchema = z.object({
  removed: z.boolean(),
});

/** Target of an add/remove: a single (category, reviewer[, phase]) scope tuple. */
export const categoryReviewerTargetSchema =
  instanceOptionalPhaseRefSchema.extend({
    taxonomyTermId: z.uuid(),
    reviewerProfileId: z.uuid(),
  });

/**
 * Candidate reviewer surfaced in the "Add reviewer…" picker. email is included
 * so the admin can disambiguate people sharing a display name.
 */
export const eligibleReviewerSchema = createSelectSchema(profiles)
  .pick({
    name: true,
    slug: true,
    avatarImageId: true,
    email: true,
  })
  .extend({
    id: z.uuid(),
  });

export type EligibleReviewerSchema = z.infer<typeof eligibleReviewerSchema>;

export const eligibleReviewersListSchema = z.object({
  reviewers: z.array(eligibleReviewerSchema),
});

/** A category (taxonomy term id + label) the current reviewer is scoped to. */
export const reviewerCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type ReviewerCategory = z.infer<typeof reviewerCategorySchema>;

export const reviewerCategoriesSchema = z.array(reviewerCategorySchema);

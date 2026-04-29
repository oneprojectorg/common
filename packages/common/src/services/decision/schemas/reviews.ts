import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import type { RubricTemplateSchema } from '../types';
import { proposalProfileSchema, proposalSchema } from './proposal';
import { taxonomyTermSchema } from './taxonomyTerm';

export {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
};

const jsonObjectSchema = z.record(z.string(), z.unknown());

const rubricTemplateSchema = jsonObjectSchema.transform(
  (data): RubricTemplateSchema => data as RubricTemplateSchema,
);

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

export const proposalReviewAssignmentSchema = z.object({
  id: z.uuid(),
  processInstanceId: z.uuid(),
  phaseId: z.string(),
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
  categories: z.array(taxonomyTermSchema),
});

/**
 * Single response shape for both filtered and paginated modes. In
 * filtered mode `total` is just `items.length` and `next` is null —
 * one shape is simpler than a union and clients can ignore the extras.
 */
export const proposalsWithReviewAggregatesListSchema = z.object({
  items: z.array(proposalWithAggregatesSchema),
  total: z.number().int(),
  next: z.string().nullable(),
});

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
export type ProposalReviewAggregates = z.infer<
  typeof proposalReviewAggregatesSchema
>;
export type ProposalWithAggregates = z.infer<
  typeof proposalWithAggregatesSchema
>;
export type ProposalsWithReviewAggregatesList = z.infer<
  typeof proposalsWithReviewAggregatesListSchema
>;

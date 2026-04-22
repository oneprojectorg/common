import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import type { RubricTemplateSchema } from '../types';
import { proposalProfileSchema, proposalSchema } from './proposal';

export { ProposalReviewAssignmentStatus, ProposalReviewRequestState };

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

// ── Lean review assignment schemas (admin overview) ─────────────────────
//
// These schemas power admin-facing screens that aggregate over every
// assignment in a process instance and refresh on realtime updates. They
// intentionally omit the heavy TipTap payload so the wire shape stays small.

export const proposalSummarySchema = proposalSchema.omit({
  documentContent: true,
  htmlContent: true,
  proposalTemplate: true,
  attachments: true,
});

export const reviewAssignmentLeanSchema = z.object({
  id: z.uuid(),
  processInstanceId: z.uuid(),
  phaseId: z.string(),
  status: z.enum(ProposalReviewAssignmentStatus),
  reviewer: proposalProfileSchema,
  proposal: proposalSummarySchema,
});

export const reviewItemSchema = z.object({
  assignment: reviewAssignmentLeanSchema,
  review: proposalReviewSchema.nullable(),
  revisionRequest: proposalReviewRequestSchema.nullable(),
});

export const reviewItemListSchema = z.object({
  items: z.array(reviewItemSchema),
  rubricTemplate: rubricTemplateSchema.nullable(),
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
export type ProposalSummary = z.infer<typeof proposalSummarySchema>;
export type ReviewAssignmentLean = z.infer<typeof reviewAssignmentLeanSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type ReviewItemList = z.infer<typeof reviewItemListSchema>;

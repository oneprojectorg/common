import { z } from 'zod';

import { eligibleReviewerSchema, reviewAssignmentListSchema } from './reviews';

export const phaseReviewerSummarySchema = z.object({
  reviewer: eligibleReviewerSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
});

export type PhaseReviewerSummary = z.infer<typeof phaseReviewerSummarySchema>;

export const phaseReviewerSummariesSchema = z.object({
  reviewers: z.array(phaseReviewerSummarySchema),
  next: z.string().nullable(),
  totalReviewers: z.number(),
  totalAssignments: z.number(),
});

export type PhaseReviewerSummaries = z.infer<
  typeof phaseReviewerSummariesSchema
>;

// ── One reviewer's queue (reviewer detail screen) ──────────────────────

export const reviewerAssignmentsSchema = z.object({
  /** Null when the profile has no tie to this process — see listReviewerAssignments. */
  reviewer: eligibleReviewerSchema.nullable(),
  /** False once the reviewer lost the REVIEW capability; their history stays visible. */
  isEligible: z.boolean(),
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  /** The reviewer's own item shape, so both screens render the same card. */
  assignments: reviewAssignmentListSchema.shape.assignments,
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;

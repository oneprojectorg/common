import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
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

export const reviewerQueueStatusSchema = z.union([
  z.enum(ProposalReviewAssignmentStatus),
  z.enum(ProposalReviewState),
]);

export type ReviewerQueueStatus = z.infer<typeof reviewerQueueStatusSchema>;

export const reviewerAssignmentsSchema = z.object({
  /** Null when the profile has no tie to this process. */
  reviewer: eligibleReviewerSchema.nullable(),
  /** False once the reviewer lost the REVIEW capability; their history stays visible. */
  isEligible: z.boolean(),
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  statusBreakdown: z.array(
    z.object({ status: reviewerQueueStatusSchema, count: z.number().int() }),
  ),
  assignments: reviewAssignmentListSchema.shape.assignments,
  next: z.string().nullable(),
  total: z.number().int(),
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;

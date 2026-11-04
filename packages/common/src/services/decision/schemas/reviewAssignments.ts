import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { z } from 'zod';

import { paginated, paginationInput, total } from '../../../utils/pagination';
import { instancePhaseRefSchema } from './instance';
import { eligibleReviewerSchema, reviewAssignmentListSchema } from './reviews';
import { SEARCH_MAX_LENGTH } from './search';

export const reviewerStatusSchema = z.enum([
  'none',
  ProposalReviewAssignmentStatus.PENDING,
  ProposalReviewAssignmentStatus.IN_PROGRESS,
  ProposalReviewAssignmentStatus.COMPLETED,
]);

export type ReviewerStatus = z.infer<typeof reviewerStatusSchema>;

export const reviewerSortSchema = z.enum([
  'leastComplete',
  'mostComplete',
  'recentActivity',
  'name',
]);

export type ReviewerSort = z.infer<typeof reviewerSortSchema>;

export const phaseReviewerSummariesInputSchema = instancePhaseRefSchema
  .extend(paginationInput('lg').shape)
  .extend({
    search: z
      .string()
      .transform((value) => value.trim().slice(0, SEARCH_MAX_LENGTH))
      .optional(),
    status: reviewerStatusSchema.optional(),
    sort: reviewerSortSchema.optional(),
  });

export type PhaseReviewerSummariesInput = z.infer<
  typeof phaseReviewerSummariesInputSchema
>;

export type PhaseReviewerSummariesParams = z.input<
  typeof phaseReviewerSummariesInputSchema
>;

export const phaseReviewerSummarySchema = z.object({
  reviewer: eligibleReviewerSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  lastSubmittedAt: z.string().nullable(),
  status: reviewerStatusSchema,
});

export type PhaseReviewerSummary = z.infer<typeof phaseReviewerSummarySchema>;

export const phaseReviewerSummariesSchema = paginated(
  phaseReviewerSummarySchema,
).extend({
  total,
  totalReviewers: total,
  totalAssignments: total,
});

export type PhaseReviewerSummaries = z.infer<
  typeof phaseReviewerSummariesSchema
>;

export const reviewerQueueStatusSchema = z.union([
  z.enum(ProposalReviewAssignmentStatus),
  z.enum(ProposalReviewState),
]);

export type ReviewerQueueStatus = z.infer<typeof reviewerQueueStatusSchema>;

export const reviewerAssignmentsSchema = reviewAssignmentListSchema.extend({
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
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;

import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { paginated, paginationInput, total } from '../../../utils/pagination';
import {
  REVIEW_REMINDER_MAX_RECIPIENTS,
  REVIEW_REMINDER_MESSAGE_MAX_LENGTH,
} from '../reviewReminderTemplate';
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

export const DEFAULT_REVIEWER_SORT: ReviewerSort = 'leastComplete';

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

export const reviewReminderRecipientsInputSchema =
  phaseReviewerSummariesInputSchema.pick({
    processInstanceId: true,
    phaseId: true,
    search: true,
    status: true,
  });

export type ReviewReminderRecipientsParams = z.input<
  typeof reviewReminderRecipientsInputSchema
>;

export const reviewReminderRecipientSchema = z.object({
  reviewer: eligibleReviewerSchema,
  remainingCount: z.number().int(),
});

export type ReviewReminderRecipient = z.infer<
  typeof reviewReminderRecipientSchema
>;

export const reviewReminderRecipientsSchema = z.object({
  items: z.array(reviewReminderRecipientSchema),
});

export type ReviewReminderRecipients = z.infer<
  typeof reviewReminderRecipientsSchema
>;

export const phaseReviewerSummarySchema = z.object({
  reviewer: eligibleReviewerSchema,
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  remainingCount: z.number(),
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

export const reviewerAssignmentsSchema = reviewAssignmentListSchema.extend({
  /** Null when the profile has no tie to this process. */
  reviewer: eligibleReviewerSchema.nullable(),
  /** False once the reviewer lost the REVIEW capability; their history stays visible. */
  isEligible: z.boolean(),
  assignedCount: z.number(),
  submittedCount: z.number(),
  draftCount: z.number(),
  remainingCount: z.number().int(),
  lastSubmittedAt: z.string().nullable(),
});

export type ReviewerAssignments = z.infer<typeof reviewerAssignmentsSchema>;

export const sendReviewReminderInputSchema = instancePhaseRefSchema.extend({
  reviewerProfileIds: z
    .array(z.uuid())
    .min(1)
    .max(REVIEW_REMINDER_MAX_RECIPIENTS),
  message: z.string().trim().min(1).max(REVIEW_REMINDER_MESSAGE_MAX_LENGTH),
});

export type SendReviewReminderInput = z.infer<
  typeof sendReviewReminderInputSchema
>;

export const sendReviewReminderResultSchema = z.object({
  batchId: z.uuid(),
});

export type SendReviewReminderResult = z.infer<
  typeof sendReviewReminderResultSchema
>;

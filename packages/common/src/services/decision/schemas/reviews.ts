import { ProposalReviewState } from '@op/db/schema';
import { z } from 'zod';

import { proposalReviewAssignmentListItemSchema } from './reviewAssignments';

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const proposalReviewSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  state: z.enum(ProposalReviewState),
  reviewData: jsonObjectSchema,
  overallComment: z.string().nullable(),
  submittedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const reviewAssignmentDetailSchema = z.object({
  assignment: proposalReviewAssignmentListItemSchema,
  rubricTemplate: jsonObjectSchema.nullable(),
  review: proposalReviewSchema.nullable(),
});

export type ProposalReviewData = z.infer<typeof proposalReviewSchema>;
export type ProposalReview = z.infer<typeof proposalReviewSchema>;
export type ReviewAssignmentDetail = z.infer<
  typeof reviewAssignmentDetailSchema
>;

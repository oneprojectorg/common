import { ProposalReviewState } from '@op/db/schema';
import { z } from 'zod';

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const proposalReviewSchema = z.object({
  id: z.uuid(),
  assignmentId: z.uuid(),
  state: z.nativeEnum(ProposalReviewState),
  reviewData: jsonObjectSchema,
  overallComment: z.string().nullable(),
  submittedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type ProposalReviewData = z.infer<typeof proposalReviewSchema>;

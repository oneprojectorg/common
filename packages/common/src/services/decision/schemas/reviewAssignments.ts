import { ProposalReviewAssignmentStatus } from '@op/db/schema';
import { z } from 'zod';

import { proposalSchema } from './proposal';

export const proposalReviewAssignmentListItemSchema = z.object({
  id: z.uuid(),
  processInstanceId: z.uuid(),
  phaseId: z.string(),
  status: z.nativeEnum(ProposalReviewAssignmentStatus),
  proposal: proposalSchema,
});

export const proposalReviewAssignmentListSchema = z.object({
  assignments: z.array(proposalReviewAssignmentListItemSchema),
  total: z.number(),
  completed: z.number(),
});

export type ProposalReviewAssignmentListItem = z.infer<
  typeof proposalReviewAssignmentListItemSchema
>;
export type ListProposalReviewAssignmentsResult = z.infer<
  typeof proposalReviewAssignmentListSchema
>;

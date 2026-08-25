import { z } from 'zod';

export const rejectProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export type RejectProposalInput = z.infer<typeof rejectProposalInputSchema>;

/** Undo is the inverse of the same proposal, so it takes the identical input. */
export const unrejectProposalInputSchema = rejectProposalInputSchema;

export type UnrejectProposalInput = RejectProposalInput;

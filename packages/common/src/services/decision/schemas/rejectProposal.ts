import { z } from 'zod';

export const rejectProposalInputSchema = z.object({
  proposalId: z.uuid(),
});

export type RejectProposalInput = z.infer<typeof rejectProposalInputSchema>;

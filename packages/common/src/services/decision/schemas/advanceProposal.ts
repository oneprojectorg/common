import { z } from 'zod';

export const getProposalAdvanceTargetInputSchema = z.object({
  proposalId: z.uuid(),
});

export const proposalAdvanceTargetSchema = z.object({
  phaseId: z.string(),
  phaseName: z.string(),
});

export const advanceProposalInputSchema = z.object({
  proposalId: z.uuid(),
  /** The phase the admin was offered; a mismatch means the decision moved on. */
  phaseId: z.string().min(1),
});

export type AdvanceProposalInput = z.infer<typeof advanceProposalInputSchema>;

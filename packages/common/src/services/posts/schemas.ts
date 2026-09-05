import { z } from 'zod';

export const listProposalCommentsSchema = z.object({
  profileId: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
  cursor: z.string().nullish(),
});

export type ListProposalCommentsInput = z.infer<
  typeof listProposalCommentsSchema
>;

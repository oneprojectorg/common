import { z } from 'zod';

/**
 * A proposal's selection record from the latest successful result run on its
 * process instance. `allocated` is stored as numeric (string) in the DB to
 * preserve precision.
 */
export const proposalSelectionSchema = z.object({
  proposalId: z.uuid(),
  allocated: z.string().nullable(),
  selectionRank: z.number().nullable(),
});

export type ProposalSelection = z.infer<typeof proposalSelectionSchema>;

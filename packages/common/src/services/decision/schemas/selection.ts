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

/**
 * The amount an admin awards a winning proposal when publishing results.
 * Stored on the selection row as `allocated`; may be above or below the
 * proposal's requested budget.
 */
export const proposalAllocationSchema = z.object({
  proposalId: z.uuid(),
  amount: z.number().positive(),
});

export type ProposalAllocation = z.infer<typeof proposalAllocationSchema>;

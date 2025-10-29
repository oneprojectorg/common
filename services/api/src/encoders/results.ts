import { ProposalStatus } from '@op/db/schema';
import { z } from 'zod';

export const proposalSummaryEncoder = z.object({
  id: z.string().uuid(),
  proposalData: z.unknown(),
  status: z.nativeEnum(ProposalStatus),
  selectionRank: z.number().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const instanceResultsEncoder = z.object({
  executedAt: z.string(),
  selectedCount: z.number(),
  proposals: z.array(proposalSummaryEncoder),
});

export const getInstanceResultsInputSchema = z.object({
  instanceId: z.uuid(),
});

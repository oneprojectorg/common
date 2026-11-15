import { z } from 'zod';

import { moneyAmountSchema } from '../../../money';
import { list } from '../../../utils/pagination';

export const listOwnDevelopedProposalsInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export type ListOwnDevelopedProposalsInput = z.infer<
  typeof listOwnDevelopedProposalsInputSchema
>;

/** A proposal an entry was developed from: the source of a `developed` edge. */
export const developedOriginSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

/**
 * One of the caller's developed proposals in the current phase. Slim: what the
 * develop screen lists, with the title and budget resolved from the document.
 */
export const ownDevelopedProposalSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  status: z.string().nullish(),
  visibility: z.string(),
  createdAt: z.string().nullish(),
  title: z.string(),
  category: z.array(z.string()),
  budget: moneyAmountSchema.nullable(),
  origins: z.array(developedOriginSchema),
});

export type OwnDevelopedProposal = z.infer<typeof ownDevelopedProposalSchema>;

export const ownDevelopedProposalListSchema = list(ownDevelopedProposalSchema);

export type OwnDevelopedProposalList = z.infer<
  typeof ownDevelopedProposalListSchema
>;

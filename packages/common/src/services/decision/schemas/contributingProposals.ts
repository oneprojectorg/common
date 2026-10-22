import { z } from 'zod';

import { list } from '../../../utils/pagination';
import { allProposalsListItemSchema } from './proposal';

export const listContributingProposalsInputSchema = z.object({
  /** The surviving proposal — the target of every `merged` edge. */
  proposalId: z.uuid(),
});

export type ListContributingProposalsInput = z.infer<
  typeof listContributingProposalsInputSchema
>;

/**
 * The same row shape as every other card surface, so the app renders these
 * through the shared card mapping that carries the anonymity rules.
 */
export const contributingProposalListSchema = list(allProposalsListItemSchema);

export type ContributingProposalList = z.infer<
  typeof contributingProposalListSchema
>;

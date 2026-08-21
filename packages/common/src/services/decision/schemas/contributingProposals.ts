import { z } from 'zod';

import { allProposalsListItemSchema } from './proposal';

export const listContributingProposalsInputSchema = z.object({
  /** The surviving proposal — the target end of every `merged` edge read here. */
  proposalId: z.uuid(),
});

export type ListContributingProposalsInput = z.infer<
  typeof listContributingProposalsInputSchema
>;

/**
 * Contributing proposals ship the same row shape as every other card surface
 * (`allProposalsListItemSchema`, the read-only list item) so the app can render
 * them through the shared card mapping — which is what carries the anonymity
 * and profile-linking rules. Unpaginated: the fan-in is one admin's merges.
 */
export const contributingProposalListSchema = z.object({
  proposals: z.array(allProposalsListItemSchema),
});

export type ContributingProposalList = z.infer<
  typeof contributingProposalListSchema
>;

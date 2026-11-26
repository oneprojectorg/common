import { ProposalStatus } from '@op/db/schema';
import { z } from 'zod';

import { paginationInput } from '../../../utils/pagination';
import { phaseIdSchema } from './instance';
import {
  phaseProposalListSchema,
  proposalSchema,
  proposalSearchSchema,
} from './proposal';

export const DEVELOP_SOURCE_SCOPES = ['all', 'assigned'] as const;

/** A source is an earlier-phase proposal an entry is, or can be, developed from; `assigned` keeps the caller's review assignments on any of `phaseIds`. */
export const listDevelopSourcesInputSchema = z
  .object({
    processInstanceId: z.uuid(),
    phaseIds: z.array(phaseIdSchema).min(1).max(10),
    scope: z.enum(DEVELOP_SOURCE_SCOPES).default('all'),
    search: proposalSearchSchema,
    categoryIds: z.array(z.uuid()).max(10).optional(),
  })
  .extend(paginationInput('md').shape);

export type ListDevelopSourcesInput = z.infer<
  typeof listDevelopSourcesInputSchema
>;

/** An entry developed from a source, as far as the caller may read it. `isComplete` is `null` when the entry is not a draft. */
export const developedProposalSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  status: z.enum(ProposalStatus).nullable(),
  isComplete: z.boolean().nullable(),
});

export type DevelopedProposal = z.infer<typeof developedProposalSchema>;

/** `developedProposals` is empty when the source has no entry the caller may read. */
export const developSourceSchema = proposalSchema.extend({
  developedProposals: z.array(developedProposalSchema),
});

export type DevelopSource = z.infer<typeof developSourceSchema>;

export const developSourceListSchema = phaseProposalListSchema.extend({
  items: z.array(developSourceSchema),
});

export type DevelopSourceList = z.infer<typeof developSourceListSchema>;

/** `publishedCount`: the advanced entries that the publish made visible. */
export const publishDevelopedProposalsResultSchema = z.object({
  publishedCount: z.number().int().nonnegative(),
});

export type PublishDevelopedProposalsResult = z.infer<
  typeof publishDevelopedProposalsResultSchema
>;

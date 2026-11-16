import { z } from 'zod';

import { paginationInput } from '../../../utils/pagination';
import { phaseIdSchema } from './instance';
import { phaseProposalListSchema, proposalSearchSchema } from './proposal';

export const DEVELOP_ORIGIN_SCOPES = ['all', 'assigned'] as const;

/**
 * Input for `decision.listDevelopOrigins`. An origin is a proposal of an
 * earlier phase that an entry is, or can be, developed from; the client names
 * those phases in `phaseIds`, and a proposal in more than one is listed once.
 *
 * - `all` (default): every proposal of the phases the caller may see.
 * - `assigned`: only those the caller holds a review assignment for on any of
 *   the phases, in any status.
 *
 * A proposal must carry every term in `categoryIds`. Search, categories and
 * pagination apply under both scopes.
 */
export const listDevelopOriginsInputSchema = z
  .object({
    processInstanceId: z.uuid(),
    phaseIds: z.array(phaseIdSchema).min(1).max(10),
    scope: z.enum(DEVELOP_ORIGIN_SCOPES).default('all'),
    search: proposalSearchSchema,
    categoryIds: z.array(z.uuid()).max(10).optional(),
  })
  .extend(paginationInput('md').shape);

export type ListDevelopOriginsInput = z.infer<
  typeof listDevelopOriginsInputSchema
>;

/** Items are `proposal.list`'s. */
export const developOriginListSchema = phaseProposalListSchema;

export type DevelopOriginList = z.infer<typeof developOriginListSchema>;

import { z } from 'zod';

import { paginationInput } from '../../../utils/pagination';
import { proposalListSchema, proposalSearchSchema } from './proposal';

/**
 * Which origins a develop screen lists:
 * - `assigned`: the origins the caller holds a review assignment for in the
 *   origin phase. The default, and what a develop holder sees.
 * - `categories`: every origin in a category the caller is a category reviewer
 *   of. Open to develop holders, not used by the screen yet.
 * - `all`: every origin. Admin only.
 */
export const developOriginScopeSchema = z.enum([
  'assigned',
  'categories',
  'all',
]);

export type DevelopOriginScope = z.infer<typeof developOriginScopeSchema>;

export const listDevelopOriginsInputSchema = z
  .object({
    processInstanceId: z.uuid(),
    scope: developOriginScopeSchema.prefault('assigned'),
    /** Narrows any scope to one category. */
    categoryId: z.uuid().optional(),
    /** Every word in the origin's title. */
    search: proposalSearchSchema,
    /** By creation: `desc` newest first (the default), `asc` oldest first. */
    dir: z.enum(['asc', 'desc']).optional(),
  })
  .extend(paginationInput('md').shape);

export type ListDevelopOriginsInput = z.input<
  typeof listDevelopOriginsInputSchema
>;

/** The caller's newest entry developed from an origin on the page. */
export const developOriginEntrySchema = z.object({
  originId: z.uuid(),
  id: z.uuid(),
  profileId: z.uuid(),
  status: z.string().nullish(),
});

export type DevelopOriginEntry = z.infer<typeof developOriginEntrySchema>;

/**
 * One page of origins, as `listProposals` returns it, with the caller's own
 * entry for each origin on the page that has one.
 */
export const developOriginListSchema = proposalListSchema.extend({
  ownEntries: z.array(developOriginEntrySchema),
});

export type DevelopOriginList = z.infer<typeof developOriginListSchema>;

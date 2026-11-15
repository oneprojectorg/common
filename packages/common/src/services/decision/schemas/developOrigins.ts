import { z } from 'zod';

import { paginationInput } from '../../../utils/pagination';

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
    dir: z.enum(['asc', 'desc']).optional(),
  })
  .extend(paginationInput('md').shape);

export type ListDevelopOriginsInput = z.input<
  typeof listDevelopOriginsInputSchema
>;

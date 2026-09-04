import { z } from 'zod';

/**
 * Taxonomy-backed category attached to a proposal. Its own module because the
 * admin schemas ship through `@op/common/client`, where importing `reviews.ts`
 * would drag server-only `@op/logging` into the client graph.
 */
export const proposalCategorySchema = z.object({
  id: z.uuid(),
  label: z.string(),
  termUri: z.string(),
});

export type ProposalCategoryItem = z.infer<typeof proposalCategorySchema>;

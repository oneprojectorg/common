import { z } from 'zod';

import { taxonomyTermSchema } from '../../terms/schemas';

export const proposalCategorySchema = taxonomyTermSchema.pick({
  id: true,
  label: true,
  termUri: true,
});

export type ProposalCategoryItem = z.infer<typeof proposalCategorySchema>;

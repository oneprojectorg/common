import { z } from 'zod';

import { list, total } from '../../../utils/pagination';

export const listDevelopCategoryTotalsInputSchema = z.object({
  processInstanceId: z.uuid(),
});

export type ListDevelopCategoryTotalsInput = z.infer<
  typeof listDevelopCategoryTotalsInputSchema
>;

/** One category of the instance with its develop counts. */
export const developCategoryTotalsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Proposals of the origin phase in the category. */
  originsTotal: total,
  /** Ready entries of the develop phase in the category. */
  readyEntriesTotal: total,
});

export type DevelopCategoryTotals = z.infer<typeof developCategoryTotalsSchema>;

/** Every category of the instance, in the instance's category order. */
export const developCategoryTotalsListSchema = list(
  developCategoryTotalsSchema,
);

export type DevelopCategoryTotalsList = z.infer<
  typeof developCategoryTotalsListSchema
>;

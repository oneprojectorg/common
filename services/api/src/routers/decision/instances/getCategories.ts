import { getProcessCategories } from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

const getCategoriesInputSchema = z.object({
  processInstanceId: z.uuid(),
});

const processCategoryEncoder = z.object({
  id: z.string(),
  name: z.string(),
  termUri: z.string(),
});

const getCategoriesOutputSchema = z.object({
  categories: z.array(processCategoryEncoder),
});

export const getCategoriesRouter = router({
  getCategories: commonNetworkProcedure()
    .input(getCategoriesInputSchema)
    .output(getCategoriesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const categories = await getProcessCategories({
        processInstanceId: input.processInstanceId,
        user,
      });

      return { categories };
    }),
});

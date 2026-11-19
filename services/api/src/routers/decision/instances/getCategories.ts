import { getProcessCategories } from '@op/common';
import { list, processCategorySchema } from '@op/common/client';
import { z } from 'zod';

import { openProcedure, router } from '../../../trpcFactory';

const getCategoriesInputSchema = z.object({
  processInstanceId: z.uuid(),
});

const getCategoriesOutputSchema = list(processCategorySchema);

export const getCategoriesRouter = router({
  getCategories: openProcedure()
    .input(getCategoriesInputSchema)
    .output(getCategoriesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const categories = await getProcessCategories({
        processInstanceId: input.processInstanceId,
        user,
      });

      return { items: categories };
    }),
});

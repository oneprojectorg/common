import { getProcessCategories } from '@op/common';
import { z } from 'zod';

import { commonOpenProcedure, router } from '../../../trpcFactory';

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
  getCategories: commonOpenProcedure()
    .input(getCategoriesInputSchema)
    .output(getCategoriesOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, accessUser } = ctx.authContext;

      const categories = await getProcessCategories({
        processInstanceId: input.processInstanceId,
        user,
        accessUser,
      });

      return { categories };
    }),
});

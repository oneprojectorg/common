import {
  categoryDevelopmentStatusInputSchema,
  categoryDevelopmentStatusListSchema,
  listCategoryDevelopmentStatus,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listCategoryDevelopmentStatusRouter = router({
  listCategoryDevelopmentStatus: networkAuthenticatedProcedure()
    .input(categoryDevelopmentStatusInputSchema)
    .output(categoryDevelopmentStatusListSchema)
    .query(async ({ ctx, input }) => {
      const categories = await listCategoryDevelopmentStatus({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });

      return { items: categories };
    }),
});

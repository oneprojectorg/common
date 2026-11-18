import { listCategoryDevelopmentStatus } from '@op/common';
import {
  categoryDevelopmentStatusInputSchema,
  categoryDevelopmentStatusListSchema,
} from '@op/common/client';

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

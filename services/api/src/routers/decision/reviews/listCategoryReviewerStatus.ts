import { listCategoryReviewerStatus } from '@op/common';
import {
  categoryReviewerStatusInputSchema,
  categoryReviewerStatusListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listCategoryReviewerStatusRouter = router({
  listCategoryReviewerStatus: networkAuthenticatedProcedure()
    .input(categoryReviewerStatusInputSchema)
    .output(categoryReviewerStatusListSchema)
    .query(async ({ ctx, input }) => {
      const categories = await listCategoryReviewerStatus({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });

      return { items: categories };
    }),
});

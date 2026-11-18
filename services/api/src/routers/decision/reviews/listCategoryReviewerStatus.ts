import { Channels, listCategoryReviewerStatus } from '@op/common';
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

      ctx.registerQueryChannels([
        Channels.decisionDevelopLock(input.processInstanceId),
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return { items: categories };
    }),
});

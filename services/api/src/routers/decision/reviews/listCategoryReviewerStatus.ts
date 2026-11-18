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

      // Confirm, unconfirm and publish publish on the develop lock channel; a
      // phase change, which picks other rows, on the instance channel.
      ctx.registerQueryChannels([
        Channels.decisionDevelopLock(input.processInstanceId),
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return { items: categories };
    }),
});

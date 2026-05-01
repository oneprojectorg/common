import {
  Channels,
  getReviewProgress,
  getReviewProgressInputSchema,
  reviewProgressSchema,
} from '@op/common';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getReviewProgressRouter = router({
  getReviewProgress: commonAuthedProcedure()
    .input(getReviewProgressInputSchema)
    .output(reviewProgressSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await getReviewProgress({
        ...input,
        user: ctx.user,
      });
    }),
});

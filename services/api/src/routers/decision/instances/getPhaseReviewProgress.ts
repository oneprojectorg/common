import {
  Channels,
  getPhaseReviewProgress,
  instancePhaseRefSchema,
  phaseReviewProgressSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getPhaseReviewProgressRouter = router({
  getPhaseReviewProgress: networkAuthenticatedProcedure()
    .input(instancePhaseRefSchema)
    .output(phaseReviewProgressSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await getPhaseReviewProgress({
        ...input,
        user: ctx.user,
      });
    }),
});

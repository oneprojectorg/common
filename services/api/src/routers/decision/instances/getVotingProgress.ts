import {
  Channels,
  getVotingProgress,
  votingProgressInputSchema,
  votingProgressSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getVotingProgressRouter = router({
  getVotingProgress: networkAuthenticatedProcedure()
    .input(votingProgressInputSchema)
    .output(votingProgressSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return await getVotingProgress({
        ...input,
        user: ctx.user,
      });
    }),
});

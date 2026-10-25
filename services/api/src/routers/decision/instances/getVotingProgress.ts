import {
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
      return await getVotingProgress({
        ...input,
        user: ctx.user,
      });
    }),
});

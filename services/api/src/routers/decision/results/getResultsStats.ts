import { cache } from '@op/cache';
import { NotFoundError, UnauthorizedError, getResultsStats } from '@op/common';
import { TRPCError } from '@trpc/server';

import {
  getResultsStatsInputSchema,
  resultsStatsEncoder,
} from '../../../encoders/results';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getResultsStatsRouter = router({
  getResultsStats: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getResultsStatsInputSchema)
    .output(resultsStatsEncoder.nullable())
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { instanceId } = input;

      const stats = await cache({
        type: 'decision',
        params: [instanceId, 'stats'],
        fetch: () =>
          getResultsStats({
            instanceId,
            user,
          }),
      });

      return stats;
    }),
});

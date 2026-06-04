import { cache } from '@op/cache';
import { getResultsStats } from '@op/common';

import {
  getResultsStatsInputSchema,
  resultsStatsEncoder,
} from '../../../encoders/results';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getResultsStatsRouter = router({
  getResultsStats: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getResultsStatsInputSchema)
    .output(resultsStatsEncoder.nullable())
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
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

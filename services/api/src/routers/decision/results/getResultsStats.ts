import { getResultsStats } from '@op/common';

import {
  getResultsStatsInputSchema,
  resultsStatsEncoder,
} from '../../../encoders/results';
import { openProcedure, router } from '../../../trpcFactory';

export const getResultsStatsRouter = router({
  getResultsStats: openProcedure({
    rateLimit: { windowSize: 10, maxRequests: 30 },
  })
    .input(getResultsStatsInputSchema)
    .output(resultsStatsEncoder.nullable())
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { instanceId } = input;

      return await getResultsStats({ instanceId, user });
    }),
});

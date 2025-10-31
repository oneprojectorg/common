import { cache } from '@op/cache';
import { NotFoundError, UnauthorizedError, getResultsStats } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  getResultsStatsInputSchema,
  resultsStatsEncoder,
} from '../../../encoders/results';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/instance/{instanceId}/results/stats',
    protect: true,
    tags: ['decision'],
    summary: 'Get statistics for decision results',
  },
};

export const getResultsStatsRouter = router({
  getResultsStats: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(getResultsStatsInputSchema)
    .output(resultsStatsEncoder.nullable())
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { instanceId } = input;

      try {
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
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Error retrieving results stats', {
          userId: user.id,
          instanceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve results stats',
        });
      }
    }),
});

import {
  NotFoundError,
  UnauthorizedError,
  getLatestResultWithProposals,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { legacyInstanceResultsEncoder } from '../../../encoders/legacyDecision';
import { getInstanceResultsInputSchema } from '../../../encoders/results';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/instance/{instanceId}/results',
    protect: true,
    tags: ['decision'],
    summary: 'Get successful proposals for a decision instance',
  },
};

export const getInstanceResultsRouter = router({
  getInstanceResults: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(getInstanceResultsInputSchema)
    .output(legacyInstanceResultsEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { limit = 20, cursor } = input ?? {};

      try {
        const result = await getLatestResultWithProposals({
          processInstanceId: input?.instanceId ?? '',
          user,
          limit,
          cursor,
        });

        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Results have not been processed yet for this instance',
          });
        }

        return result;
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

        logger.error('Error retrieving instance results', {
          userId: user.id,
          instanceId: input?.instanceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve instance results',
        });
      }
    }),
});

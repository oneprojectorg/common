import { getSelectionResults } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/transitions/results/{processInstanceId}',
    protect: true,
    tags: ['decision'],
    summary: 'Get selected proposals (results) for a process instance',
  },
};

const inputSchema = z.object({
  processInstanceId: z.string().uuid(),
});


export const getResultsRouter = router({
  getSelectionResults: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await getSelectionResults({
          processInstanceId: input.processInstanceId,
        });

        return result;
      } catch (error) {
        logger.error('Error getting selection results', {
          userId: user.id,
          processInstanceId: input.processInstanceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get selection results',
        });
      }
    }),
});

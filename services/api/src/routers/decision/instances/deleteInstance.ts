import {
  NotFoundError,
  UnauthorizedError,
  deleteInstance as deleteInstanceService,
} from '@op/common';
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
    method: 'DELETE',
    path: '/decision/instance/{instanceId}',
    protect: true,
    tags: ['decision'],
    summary: 'Delete or archive process instance',
  },
};

export const deleteInstanceRouter = router({
  deleteInstance: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(
      z.object({
        instanceId: z.string().uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        action: z.enum(['deleted', 'archived']),
        instanceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await deleteInstanceService({
          instanceId: input.instanceId,
          user,
        });

        logger.info('Process instance deleted/archived', {
          userId: user.id,
          instanceId: input.instanceId,
          action: result.action,
        });

        return result;
      } catch (error: unknown) {
        logger.error('Failed to delete process instance', {
          userId: user.id,
          instanceId: input.instanceId,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: error.message,
            code: 'NOT_FOUND',
          });
        }

        throw new TRPCError({
          message: 'Failed to delete process instance',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

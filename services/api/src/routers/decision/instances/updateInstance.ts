import { NotFoundError, UnauthorizedError, updateInstance } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  processInstanceEncoder,
  updateInstanceInputSchema,
} from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PATCH',
    path: '/decision/instance/{instanceId}',
    protect: true,
    tags: ['decision'],
    summary: 'Update process instance',
  },
};

export const updateInstanceRouter = router({
  updateInstance: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(updateInstanceInputSchema)
    .output(processInstanceEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      if (!input.instanceId) {
        throw new TRPCError({
          message: 'Instance ID is required',
          code: 'BAD_REQUEST',
        });
      }

      try {
        const instance = await updateInstance({
          data: {
            instanceId: input.instanceId,
            authUserId: user.id,
            name: input.name,
            description: input.description,
            instanceData: input.instanceData,
            status: input.status,
          },
          user,
        });

        logger.info('Process instance updated', {
          userId: user.id,
          instanceId: instance.id,
          instanceName: instance.name,
        });

        return processInstanceEncoder.parse(instance);
      } catch (error: unknown) {
        logger.error('Failed to update process instance', {
          userId: user.id,
          instanceId: input.instanceId,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message:
              'You do not have permission to update this process instance',
            code: 'UNAUTHORIZED',
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: 'Process instance not found',
            code: 'NOT_FOUND',
          });
        }

        throw new TRPCError({
          message: 'Failed to update process instance',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

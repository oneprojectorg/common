import { NotFoundError, UnauthorizedError, createInstance } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  createInstanceInputSchema,
  processInstanceEncoder,
} from '../../../encoders/legacyDecision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/instance',
    protect: true,
    tags: ['decision'],
    summary: 'Create process instance',
  },
};

export const createInstanceRouter = router({
  createInstance: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(createInstanceInputSchema)
    .output(processInstanceEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const instance = await createInstance({ data: input, user });

        logger.info('Process instance created', {
          userId: user.id,
          instanceId: instance.id,
          instanceName: instance.name,
          processId: input.processId,
        });

        return processInstanceEncoder.parse(instance);
      } catch (error: unknown) {
        logger.error('Failed to create process instance', {
          userId: user.id,
          instanceName: input.name,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to create process instances',
            code: 'UNAUTHORIZED',
          });
        }

        if (error instanceof NotFoundError) {
          throw new TRPCError({
            message: 'Decision process not found',
            code: 'NOT_FOUND',
          });
        }

        throw new TRPCError({
          message: 'Failed to create process instance',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

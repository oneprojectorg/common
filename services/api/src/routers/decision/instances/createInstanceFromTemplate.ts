import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  createInstanceFromTemplate,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  createInstanceFromTemplateInputSchema,
  processInstanceNewEncoder,
} from '../../../encoders/decision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/instance/from-template',
    protect: true,
    tags: ['decision'],
    summary: 'Create process instance from a VotingSchemaDefinition template',
  },
};

export const createInstanceFromTemplateRouter = router({
  createInstanceFromTemplate: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(createInstanceFromTemplateInputSchema)
    .output(processInstanceNewEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const instance = await createInstanceFromTemplate({
          data: input,
          user,
        });

        logger.info('Process instance created from template', {
          userId: user.id,
          instanceId: instance.id,
          instanceName: instance.name,
          processId: input.processId,
        });

        return processInstanceNewEncoder.parse(instance);
      } catch (error: unknown) {
        logger.error('Failed to create process instance from template', {
          userId: user.id,
          instanceName: input.name,
          processId: input.processId,
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
            message: 'Template not found',
            code: 'NOT_FOUND',
          });
        }

        if (error instanceof CommonError) {
          throw new TRPCError({
            message: error.message,
            code: 'BAD_REQUEST',
          });
        }

        throw new TRPCError({
          message: 'Failed to create process instance',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

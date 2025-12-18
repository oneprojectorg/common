import { UnauthorizedError, createProcess } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import {
  createProcessInputSchema,
  decisionProcessEncoder,
} from '../../../encoders/legacyDecision';
import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/process',
    protect: true,
    tags: ['decision'],
    summary: 'Create decision process template',
  },
};

export const createProcessRouter = router({
  createProcess: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(createProcessInputSchema)
    .output(decisionProcessEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const process = await createProcess({ data: input, user });

        logger.info('Decision process created', {
          userId: user.id,
          processId: process.id,
          processName: process.name,
        });

        return decisionProcessEncoder.parse(process);
      } catch (error: unknown) {
        logger.error('Failed to create decision process', {
          userId: user.id,
          processName: input.name,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to create decision processes',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to create decision process',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

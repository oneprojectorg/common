import {
  NotFoundError,
  UnauthorizedError,
  deleteDecision as deleteDecisionService,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const deleteDecisionRouter = router({
  deleteDecision: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        instanceId: z.uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        deletedId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await deleteDecisionService({
          instanceId: input.instanceId,
          user,
        });

        logger.info('Decision deleted', {
          userId: user.id,
          instanceId: input.instanceId,
        });

        return result;
      } catch (error: unknown) {
        logger.error('Failed to delete decision', {
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
          message: 'Failed to delete decision',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

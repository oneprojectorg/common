import {
  NotFoundError,
  UnauthorizedError,
  deleteInstance as deleteInstanceService,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const deleteInstanceRouter = router({
  deleteInstance: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.string().uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        action: z.enum(['deleted', 'cancelled']),
        instanceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        const result = await deleteInstanceService({
          instanceId: input.instanceId,
          user,
        });

        return result;
      } catch (error: unknown) {
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

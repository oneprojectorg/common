import {
  NotFoundError,
  UnauthorizedError,
  executeTransition,
} from '@op/common';
import { TRPCError } from '@trpc/server';

import { executeTransitionInputSchema } from '../../../encoders/decision';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

export const executeTransitionRouter = router({
  executeTransition: loggedProcedure
    .use(withAuthenticated)
    .input(executeTransitionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      // TODO: This is temporary for now while testing

      if (user.email !== 'scott@oneproject.org') {
        throw new UnauthorizedError('You cannot execute transitions');
      }

      try {
        const result = await executeTransition({
          data: input,
          user,
        });

        logger.info('Transition executed', {
          userId: user.id,
          instanceId: input.instanceId,
          toStateId: input.toStateId,
        });

        return result;
      } catch (error: unknown) {
        console.error('Failed to execute transition', {
          userId: user.id,
          instanceId: input.instanceId,
          toStateId: input.toStateId,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to execute this transition',
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
          message: 'Failed to execute transition',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

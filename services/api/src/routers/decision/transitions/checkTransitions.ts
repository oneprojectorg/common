import { checkTransitions, UnauthorizedError, NotFoundError } from '@op/common';
import { TRPCError } from '@trpc/server';
import { checkTransitionInputSchema, transitionCheckResultEncoder } from '../../../encoders/decision';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

export const checkTransitionsRouter = router({
  checkTransitions: loggedProcedure
    .use(withAuthenticated)
    .input(checkTransitionInputSchema)
    .output(transitionCheckResultEncoder)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await checkTransitions({
          data: input,
          user,
        });

        logger.info('Transitions checked', {
          userId: user.id,
          instanceId: input.instanceId,
        });

        return result;
      } catch (error: unknown) {
        console.error('Failed to check transitions', {
          userId: user.id,
          instanceId: input.instanceId,
          error,
        });

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to check transitions',
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
          message: 'Failed to check transitions',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
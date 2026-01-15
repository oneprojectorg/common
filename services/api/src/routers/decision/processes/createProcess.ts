import { UnauthorizedError, createProcess } from '@op/common';
import { TRPCError } from '@trpc/server';

import {
  legacyCreateProcessInputSchema,
  legacyDecisionProcessEncoder,
} from '../../../encoders/legacyDecision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

/** @deprecated Use the new decision system instead */
export const createProcessRouter = router({
  createProcess: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(legacyCreateProcessInputSchema)
    .output(legacyDecisionProcessEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const process = await createProcess({ data: input, user });

        logger.info('Decision process created', {
          userId: user.id,
          processId: process.id,
          processName: process.name,
        });

        return legacyDecisionProcessEncoder.parse(process);
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

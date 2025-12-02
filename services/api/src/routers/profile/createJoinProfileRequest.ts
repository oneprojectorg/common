import { ConflictError, ValidationError } from '@op/common';
import { createJoinProfileRequest } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../encoders/joinProfileRequests';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  /** The profile ID of the requester */
  requestProfileId: z.uuid(),
  /** The profile ID of the target to join */
  targetProfileId: z.uuid(),
});

export const createJoinProfileRequestRouter = router({
  createJoinProfileRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input }) => {
      try {
        const result = await createJoinProfileRequest({
          requestProfileId: input.requestProfileId,
          targetProfileId: input.targetProfileId,
        });
        return joinProfileRequestEncoder.parse(result);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        if (error instanceof ConflictError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to create join request',
        });
      }
    }),
});

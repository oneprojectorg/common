import { ValidationError } from '@op/common';
import { getJoinProfileRequest } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  /** The profile ID of the requester */
  requestProfileId: z.uuid(),
  /** The profile ID of the target to join */
  targetProfileId: z.uuid(),
});

export const getJoinProfileRequestRouter = router({
  getJoinProfileRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 60 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .query(async ({ input }) => {
      try {
        return await getJoinProfileRequest({
          requestProfileId: input.requestProfileId,
          targetProfileId: input.targetProfileId,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to get join request',
        });
      }
    }),
});

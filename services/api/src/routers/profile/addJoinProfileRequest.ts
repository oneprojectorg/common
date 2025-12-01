import { addJoinProfileRequest } from '@op/common';
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

export const addJoinProfileRequestRouter = router({
  addJoinProfileRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .mutation(async ({ input }) => {
      try {
        await addJoinProfileRequest({
          requestProfileId: input.requestProfileId,
          targetProfileId: input.targetProfileId,
        });
      } catch (error) {
        if (error instanceof Error) {
          // Map common errors to tRPC errors
          if (error.message.includes('Cannot request to join your own')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message,
            });
          }
          if (error.message.includes('already exists')) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: error.message,
            });
          }
          if (
            error.message.includes('Only user profiles') ||
            error.message.includes('can only be made to organization')
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message,
            });
          }
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

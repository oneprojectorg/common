import { UnauthorizedError, ValidationError } from '@op/common';
import { updateJoinProfileRequest } from '@op/common';
import { JoinProfileRequestStatus } from '@op/db/schema';
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
  /** New status for the request */
  status: z.enum(['approved', 'rejected']),
});

export const updateJoinProfileRequestRouter = router({
  updateJoinProfileRequest: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(joinProfileRequestEncoder)
    .mutation(async ({ input, ctx }) => {
      try {
        const statusEnum =
          input.status === 'approved'
            ? JoinProfileRequestStatus.APPROVED
            : JoinProfileRequestStatus.REJECTED;

        const result = await updateJoinProfileRequest({
          user: ctx.user,
          requestProfileId: input.requestProfileId,
          targetProfileId: input.targetProfileId,
          status: statusEnum,
        });

        return joinProfileRequestEncoder.parse(result);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error.message,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update join request',
        });
      }
    }),
});

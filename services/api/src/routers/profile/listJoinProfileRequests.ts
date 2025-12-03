import { UnauthorizedError, ValidationError } from '@op/common';
import { listJoinProfileRequests } from '@op/common';
import { JoinProfileRequestStatus } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { AccessControlException } from 'access-zones';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../encoders/joinProfileRequests';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const inputSchema = dbFilter.extend({
  /** The profile ID of the target to view join requests for */
  targetProfileId: z.uuid(),
  /** Optional status to filter requests by */
  status: z.nativeEnum(JoinProfileRequestStatus).optional(),
});

export const listJoinProfileRequestsRouter = router({
  listJoinProfileRequests: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 60 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(joinProfileRequestEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit = 10, cursor, dir } = input;

      try {
        const { items, next, hasMore } = await listJoinProfileRequests({
          user: ctx.user,
          targetProfileId: input.targetProfileId,
          status: input.status,
          cursor,
          limit,
          dir,
        });

        return {
          items: items.map((item) => joinProfileRequestEncoder.parse(item)),
          next,
          hasMore,
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        if (
          error instanceof UnauthorizedError ||
          error instanceof AccessControlException
        ) {
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
              : 'Failed to list join requests',
        });
      }
    }),
});

import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  getCollabToken,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getCollabTokenRouter = router({
  getCollabToken: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
    .input(
      z.object({
        proposalProfileId: z.uuid(),
      }),
    )
    .output(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        return await getCollabToken({
          proposalProfileId: input.proposalProfileId,
          user,
        });
      } catch (error: unknown) {
        if (error instanceof NotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error.message,
          });
        }
        if (error instanceof ValidationError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});

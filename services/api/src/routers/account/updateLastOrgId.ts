import { switchUserOrganization } from '@op/common';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const switchOrganization = router({
  switchOrganization: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { id } = ctx.user;

      try {
        const result = await switchUserOrganization({
          authUserId: id,
          organizationId: input.organizationId,
        });
        return userEncoder.parse(result);
      } catch (error) {
        logger.error('Error switching organization', {
          error,
          organizationId: input.organizationId,
        });

        if (error instanceof Error) {
          if (error.message === 'Organization not found') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Organization not found',
            });
          }
          if (error.message === 'User not found') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'User not found',
            });
          }
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update currentProfileId',
        });
      }
    }),
});

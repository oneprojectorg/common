import { CommonError, deleteProfileInvitation } from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const deleteInputSchema = z.object({
  inviteId: z.string().uuid(),
  profileId: z.string().uuid(),
});

const deleteOutputSchema = z.object({
  success: z.boolean(),
  email: z.string(),
});

export const invitationRouter = router({
  deleteInvitation: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 20 },
  })
    .input(deleteInputSchema)
    .output(deleteOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { user } = ctx;

        const result = await deleteProfileInvitation({
          inviteId: input.inviteId,
          profileId: input.profileId,
          user,
        });

        return result;
      } catch (error) {
        if (error instanceof CommonError) {
          throw error;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to delete invitation';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});

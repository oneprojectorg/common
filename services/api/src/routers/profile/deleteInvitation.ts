import { deleteProfileInvitation } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteInvitationRouter = router({
  deleteInvitation: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 20 },
  })
    .input(
      z.object({
        inviteId: z.string().uuid(),
        profileId: z.string().uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        email: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return deleteProfileInvitation({
        inviteId: input.inviteId,
        profileId: input.profileId,
        user: ctx.user,
      });
    }),
});

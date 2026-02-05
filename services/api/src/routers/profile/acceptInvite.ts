import { invalidate } from '@op/cache';
import { acceptProfileInvite } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const acceptInviteRouter = router({
  acceptInvite: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(
      z.object({
        inviteId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await acceptProfileInvite({
        inviteId: input.inviteId,
        user: ctx.user,
      });

      // Invalidate user cache so they see the new profile membership
      waitUntil(invalidate({ type: 'user', params: [ctx.user.id] }));

      return result.profileUser;
    }),
});

import { invalidate } from '@op/cache';
import { acceptProfileInvite } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const acceptInviteRouter = router({
  acceptInvite: networkAuthenticatedProcedure()
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

      // Await — `waitUntil` would let the response return before the cache
      // bust completed, so the caller's next request could still see the
      // pre-accept membership.
      await invalidate({ type: 'user', params: [ctx.user.id] });

      return result.profileUser;
    }),
});

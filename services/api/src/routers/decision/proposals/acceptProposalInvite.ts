import { invalidate } from '@op/cache';
import { acceptProposalInvite } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const acceptProposalInviteRouter = router({
  acceptProposalInvite: networkAuthenticatedProcedure()
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await acceptProposalInvite({
        profileId: input.profileId,
        user: ctx.user,
      });

      // Await — `waitUntil` would let the response return before the cache
      // bust completed, so the caller's next request could still see the
      // pre-accept membership.
      await invalidate({ type: 'user', params: [ctx.user.id] });
    }),
});

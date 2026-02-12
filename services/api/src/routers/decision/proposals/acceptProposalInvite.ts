import { invalidate } from '@op/cache';
import { acceptProposalInvite } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const acceptProposalInviteRouter = router({
  acceptProposalInvite: commonAuthedProcedure()
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await acceptProposalInvite({
        profileId: input.profileId,
        user: ctx.user,
      });

      // Invalidate user cache so they see the new profile memberships
      waitUntil(invalidate({ type: 'user', params: [ctx.user.id] }));
    }),
});

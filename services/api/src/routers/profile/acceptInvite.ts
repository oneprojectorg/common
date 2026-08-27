import { invalidate } from '@op/cache';
import { Channels, acceptProfileInvite } from '@op/common';
import { waitUntil } from '@vercel/functions';
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

      // Invalidate user cache so they see the new profile membership
      waitUntil(invalidate({ type: 'user', params: [ctx.user.id] }));

      // Accepting turns a pending invite into a member: the pending count
      // drops and the member count rises for everyone watching.
      ctx.registerMutationChannels([
        Channels.profileMembers(result.profileUser.profileId),
      ]);

      return result.profileUser;
    }),
});

import { Channels, acceptProfileInvite } from '@op/common';
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

      // Accepting turns a pending invite into a member: the pending count
      // drops and the member count rises for everyone watching.
      ctx.registerMutationChannels([
        Channels.profileMembers(result.profileUser.profileId),
      ]);

      return result.profileUser;
    }),
});

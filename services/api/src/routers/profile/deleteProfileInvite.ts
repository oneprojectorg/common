import { Channels, deleteProfileInvite } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const deleteProfileInviteRouter = router({
  deleteProfileInvite: networkAuthenticatedProcedure()
    .input(z.object({ inviteId: z.string().uuid() }))
    .output(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteProfileInvite({
        inviteId: input.inviteId,
        user: ctx.user,
      });

      ctx.registerMutationChannels([Channels.profileMembers(result.profileId)]);

      return { id: result.id };
    }),
});

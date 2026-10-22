import { Channels, removeProfileUser } from '@op/common';
import { profileUserSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const removeUserRouter = router({
  removeUser: networkAuthenticatedProcedure()
    .input(z.object({ profileUserId: z.uuid() }))
    .output(profileUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId } = input;

      const removedUser = await removeProfileUser({
        profileUserId,
        user,
      });

      ctx.registerMutationChannels([
        Channels.profileMembers(removedUser.profileId),
      ]);

      return removedUser;
    }),
});

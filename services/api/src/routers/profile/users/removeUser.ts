import { removeProfileUser } from '@op/common';
import { profileUserSchema } from '@op/common/client';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const removeUserRouter = router({
  removeUser: commonNetworkProcedure()
    .input(z.object({ profileUserId: z.uuid() }))
    .output(profileUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId } = input;

      return removeProfileUser({
        profileUserId,
        user,
      });
    }),
});

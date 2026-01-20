import { removeProfileUser } from '@op/common';
import { z } from 'zod';

import { profileUserEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const removeUserRouter = router({
  removeUser: commonAuthedProcedure()
    .input(z.object({ profileUserId: z.uuid() }))
    .output(profileUserEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileUserId } = input;

      const result = await removeProfileUser({
        profileUserId,
        user,
      });

      return profileUserEncoder.parse(result);
    }),
});

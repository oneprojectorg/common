import { listProfileUsers } from '@op/common';
import { z } from 'zod';

import { profileUserListEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listUsersRouter = router({
  listUsers: commonAuthedProcedure()
    .input(z.object({ profileId: z.uuid() }))
    .output(profileUserListEncoder)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId } = input;

      const users = await listProfileUsers({
        profileId,
        user,
      });

      return profileUserListEncoder.parse(users);
    }),
});

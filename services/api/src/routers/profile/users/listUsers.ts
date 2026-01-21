import { listProfileUsers } from '@op/common';
import { z } from 'zod';

import { profileUserEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listUsersRouter = router({
  listUsers: commonAuthedProcedure()
    .input(z.object({ profileId: z.uuid() }))
    .output(z.array(profileUserEncoder))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId } = input;

      return listProfileUsers({
        profileId,
        user,
      });
    }),
});

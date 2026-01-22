import { listProfileUsers } from '@op/common';
import { z } from 'zod';

import { profileUserEncoder } from '../../../encoders/profiles';
import { commonAuthedProcedure, router } from '../../../trpcFactory';
import { createSortable } from '../../../utils';

const profileUserSortable = createSortable(['name', 'email', 'role'] as const);

export const listUsersRouter = router({
  listUsers: commonAuthedProcedure()
    .input(
      z
        .object({
          profileId: z.uuid(),
        })
        .merge(profileUserSortable),
    )
    .output(z.array(profileUserEncoder))
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, orderBy, dir } = input;

      return listProfileUsers({
        profileId,
        user,
        orderBy,
        dir,
      });
    }),
});

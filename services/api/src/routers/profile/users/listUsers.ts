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
          query: z.string().min(2).optional(),
          cursor: z.string().nullish(),
          limit: z.number().min(1).max(100).optional(),
        })
        .merge(profileUserSortable),
    )
    .output(
      z.object({
        items: z.array(profileUserEncoder),
        next: z.string().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, orderBy, dir, query, cursor, limit } = input;

      return listProfileUsers({
        profileId,
        user,
        orderBy,
        dir,
        query,
        cursor,
        limit,
      });
    }),
});

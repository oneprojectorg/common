import { Channels, listProfileUsers } from '@op/common';
import { PAGE_LIMIT, profileUserWithRolesSchema } from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { createSortable } from '../../../utils';

const profileUserSortable = createSortable(['name', 'email', 'role'] as const);

export const listUsersRouter = router({
  listUsers: networkAuthenticatedProcedure()
    .input(
      z
        .object({
          profileId: z.uuid(),
          query: z.string().min(2).optional(),
          roleId: z.uuid().optional(),
          cursor: z.string().nullish(),
          limit: z.number().min(1).max(PAGE_LIMIT.max).optional(),
        })
        .merge(profileUserSortable),
    )
    .output(
      z.object({
        items: z.array(profileUserWithRolesSchema),
        next: z.string().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { profileId, orderBy, dir, query, roleId, cursor, limit } = input;

      const result = await listProfileUsers({
        profileId,
        user,
        orderBy,
        dir,
        query,
        roleId,
        cursor,
        limit,
      });

      ctx.registerQueryChannels([Channels.profileMembers(profileId)]);

      return result;
    }),
});

import { listAllUsers } from '@op/common';
import { z } from 'zod';

import { userEncoder } from '../../../encoders/';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

export const listAllUsersRouter = router({
  listAllUsers: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      dbFilter
        .extend({
          /** string for searching users by email (for now) */
          query: z.string().optional(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(userEncoder),
        next: z.string().nullish(),
        total: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const { cursor, dir, query, limit } = input ?? {};

      const { items, next, total } = await listAllUsers({
        cursor,
        dir,
        query,
        limit,
      });

      return {
        // The list already loads the `authUser` relation (for `lastSignInAt`),
        // so read `isAnonymous` from it — no extra query, and there's no
        // per-user session available here.
        items: items.map((user) =>
          userEncoder.parse({
            ...user,
            isAnonymous: Boolean(user.authUser?.isAnonymous),
          }),
        ),
        next,
        total,
      };
    }),
});

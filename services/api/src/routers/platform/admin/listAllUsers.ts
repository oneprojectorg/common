import { listAllUsers } from '@op/common';
import { paginated, total } from '@op/common/client';
import { z } from 'zod';

import { adminUserEncoder } from '../../../encoders/';
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
          /** include anonymous accounts in the results (excluded by default) */
          includeAnonymous: z.boolean().optional(),
        })
        .optional(),
    )
    .output(paginated(adminUserEncoder).extend({ total }))
    .query(async ({ input }) => {
      const { cursor, dir, query, limit, includeAnonymous } = input ?? {};

      const {
        items: users,
        next,
        total: totalCount,
      } = await listAllUsers({
        cursor,
        dir,
        query,
        limit,
        includeAnonymous,
      });

      return {
        items: users.map((user) =>
          adminUserEncoder.parse({
            ...user,
            // Email is authoritative on auth.users, not public.users.
            email: user.authUser?.email ?? null,
            isAnonymous: Boolean(user.authUser?.isAnonymous),
            lastSignInAt: user.authUser?.lastSignInAt ?? null,
          }),
        ),
        next,
        total: totalCount,
      };
    }),
});

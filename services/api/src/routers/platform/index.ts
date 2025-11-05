import { getPlatformStats } from '@op/common';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

export const platformRouter = router({
  getStats: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(z.void())
    .output(
      z.object({
        totalOrganizations: z.number(),
        totalRelationships: z.number(),
        newOrganizations: z.number(),
        totalUsers: z.number(),
      }),
    )
    .query(async ({ ctx }) => {
      const { user } = ctx;
      return await getPlatformStats({ user });
    }),
});

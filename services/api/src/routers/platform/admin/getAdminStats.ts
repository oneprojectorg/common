import { cache } from '@op/cache';
import { count, db } from '@op/db/client';
import { organizations, processInstances, users } from '@op/db/schema';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

const STATS_TTL = 5 * 60 * 1000;

export const getAdminStatsRouter = router({
  getStats: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(z.void())
    .output(
      z.object({
        totalUsers: z.number(),
        totalOrganizations: z.number(),
        totalDecisionInstances: z.number(),
      }),
    )
    .query(async () => {
      return cache<{
        totalUsers: number;
        totalOrganizations: number;
        totalDecisionInstances: number;
      }>({
        type: 'platform',
        params: ['admin-stats'],
        fetch: async () => {
          const [[usersRow], [orgsRow], [decisionsRow]] = await Promise.all([
            db.select({ value: count() }).from(users),
            db.select({ value: count() }).from(organizations),
            db.select({ value: count() }).from(processInstances),
          ]);
          return {
            totalUsers: usersRow?.value ?? 0,
            totalOrganizations: orgsRow?.value ?? 0,
            totalDecisionInstances: decisionsRow?.value ?? 0,
          };
        },
        options: { ttl: STATS_TTL },
      });
    }),
});

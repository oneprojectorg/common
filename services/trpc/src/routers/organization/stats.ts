import { getOrganizationStats } from '@op/common';
import { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/stats',
    protect: true,
    tags: ['organization'],
    summary: 'Get organization statistics',
  },
};

export const organizationStatsRouter = router({
  getStats: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(z.void())
    .query(async ({ ctx }) => {
      const { user } = ctx;
      return await getOrganizationStats({ user });
    }),
});

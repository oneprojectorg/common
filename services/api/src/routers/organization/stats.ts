import { getPlatformStats } from '@op/common';
import { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

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

/**
 * @deprecated Kept to maintain backward compatibility.
 * TODO: remove!
 */
export const organizationStatsRouter = router({
  getStats: commonAuthedProcedure()
    .meta(meta)
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

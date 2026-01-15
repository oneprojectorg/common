import { getPlatformStats } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

/**
 * @deprecated Kept to maintain backward compatibility.
 * TODO: remove!
 */
export const organizationStatsRouter = router({
  getStats: commonAuthedProcedure()
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

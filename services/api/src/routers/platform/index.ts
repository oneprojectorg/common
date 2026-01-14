import { getPlatformStats } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { platformAdminRouter } from './admin';

/**
 * Handles platform-wide operations such as retrieving statistics, listing profiles, users, organizations, etc,.
 */
export const platformRouter = router({
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
  admin: platformAdminRouter,
});

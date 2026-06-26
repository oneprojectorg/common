import { getPlatformStats } from '@op/common';
import { z } from 'zod';

import { getCachedAuthUser } from '../../supabase/server';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { platformAdminRouter } from './admin';

/**
 * Handles platform-wide operations such as retrieving statistics, listing profiles, users, organizations, etc,.
 */
export const platformRouter = router({
  getStats: networkAuthenticatedProcedure()
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
      // `last_sign_in_at` is not on the JWT-claims `ctx.user`. Cached, so no
      // extra GoTrue round-trip.
      const authUser = await getCachedAuthUser(ctx);
      return await getPlatformStats({
        lastSignInAt: authUser.data?.user?.last_sign_in_at,
      });
    }),
  admin: platformAdminRouter,
});

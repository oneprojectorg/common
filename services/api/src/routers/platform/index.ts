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
      // Network-tier middleware already validated and cached the
      // authoritative `UserResponse` on `ctx`, so this is a WeakMap hit, not
      // a fresh GoTrue round-trip. We reach for the SDK shape only because
      // `last_sign_in_at` is not on the narrower JWT-claims `ctx.user`.
      const authUser = await getCachedAuthUser(ctx);
      return await getPlatformStats({
        lastSignInAt: authUser.data?.user?.last_sign_in_at,
      });
    }),
  admin: platformAdminRouter,
});

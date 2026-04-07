import { invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { EntityType, profiles, users } from '@op/db/schema';
import { createSBServiceClient } from '@op/supabase/server';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

export const removeUserRouter = router({
  removeUser: commonProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        authUserId: z.string().uuid(),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const { authUserId } = input;

      // Look up the user's individual profile ID before deletion so we can
      // clean it up afterward (cascade only removes the users row, not profiles)
      const user = await db._query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, authUserId),
        columns: { profileId: true },
        with: {
          profile: {
            columns: { id: true, type: true },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Delete the user from Supabase Auth.
      // This cascades to: users, profileUsers, organizationUsers (and their role junction tables).
      const supabase = createSBServiceClient();
      const { error } = await supabase.auth.admin.deleteUser(authUserId);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete user from auth: ${error.message}`,
        });
      }

      // Delete the user's individual profile, which is not cascade-deleted
      // by the auth user deletion (profiles are standalone entities).
      if (user.profile && user.profile.type === EntityType.INDIVIDUAL) {
        await db.delete(profiles).where(eq(profiles.id, user.profile.id));
      }

      // Invalidate all cache entries for this user
      await invalidate({ type: 'user', params: [authUserId] });

      return { success: true };
    }),
});

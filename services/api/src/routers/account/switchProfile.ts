import { users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const endpoint = 'switchProfile';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Switch user current profile',
  },
};

export const switchProfile = router({
  switchProfile: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(z.object({ profileId: z.string().uuid() }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { id } = ctx.user;

      // Verify the profile exists and the user has access to it
      const user = await db.query.users.findFirst({
        where: eq(users.authUserId, id),
        with: {
          profile: true,
          organizationUsers: {
            with: {
              organization: {
                with: {
                  profile: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if the profile ID is valid for this user
      const hasAccess = 
        (user.profile && (user.profile as any).id === input.profileId) ||
        user.organizationUsers.some(orgUser => {
          const profile = orgUser.organization?.profile as any;
          return profile && profile.id === input.profileId;
        });

      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied to this profile',
        });
      }

      let result;
      try {
        result = await db
          .update(users)
          .set({ currentProfileId: input.profileId })
          .where(eq(users.authUserId, id))
          .returning();
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update current profile',
        });
      }

      if (!result.length || !result[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return userEncoder.parse(result[0]);
    }),
});
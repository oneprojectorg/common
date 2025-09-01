import { invalidate } from '@op/cache';
import { getUserForProfileSwitch, updateUserCurrentProfile } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';
import { assertAccess, permission } from 'access-zones';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
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
    .meta(meta)
    .input(z.object({ profileId: z.string().uuid() }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { id } = ctx.user;

      // Verify the profile exists and the user has access to it
      const user = await getUserForProfileSwitch({ authUserId: id });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if switching to user's own individual profile
      if (user.profile && (user.profile as any).id === input.profileId) {
        // Allow switching to user's own individual profile
      } else {
        // Check organization profiles - must have admin role
        const orgUser = user.organizationUsers.find((orgUser) => {
          const profile = orgUser.organization?.profile as any;
          return profile && profile.id === input.profileId;
        });

        if (!orgUser) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this profile',
          });
        }

        // Use assertAccess to check admin permission
        try {
          assertAccess({ profile: permission.ADMIN }, orgUser.roles ?? []);
        } catch (error) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin role required for organization profiles',
          });
        }
      }

      const org = user.organizationUsers.find((orgUser) => {
        const profile = orgUser.organization?.profile as any;
        return profile && profile.id === input.profileId;
      });

      let result;
      try {
        result = await updateUserCurrentProfile({
          authUserId: id,
          profileId: input.profileId,
          orgId: org?.organization?.id,
        });
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

      // Invalidate user cache since current profile/organization context has changed
      // We should wait for invalidation as we want to switch profiles immediately and want to fail if cache doesn't properly invalidate
      await invalidate({
        type: 'user',
        params: [id],
      });

      return userEncoder.parse(result[0]);
    }),
});

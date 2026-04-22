import { invalidate } from '@op/cache';
import {
  NotFoundError,
  UnauthorizedError,
  getNormalizedRoles,
  getUserForProfileSwitch,
  updateUserCurrentProfile,
} from '@op/common';
import type { Profile } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const switchProfile = router({
  switchProfile: commonAuthedProcedure()
    .input(z.object({ profileId: z.uuid() }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { id } = ctx.user;

      // Verify the profile exists and the user has access to it
      const user = await getUserForProfileSwitch({ authUserId: id });

      if (!user) {
        throw new NotFoundError('User');
      }

      // Check if switching to user's own individual profile
      if (user.profile && (user.profile as Profile).id === input.profileId) {
        // Allow switching to user's own individual profile
      } else {
        // Check organization profiles - must have admin role
        const orgUser = user.organizationUsers.find((orgUser) => {
          const profile = orgUser.organization?.profile as Profile;
          return profile && profile.id === input.profileId;
        });

        if (!orgUser) {
          throw new UnauthorizedError('Access denied to this profile');
        }

        const normalizedRoles = getNormalizedRoles(orgUser.roles);
        assertAccess({ profile: permission.ADMIN }, normalizedRoles ?? []);
      }

      const org = user.organizationUsers.find((orgUser) => {
        const profile = orgUser.organization?.profile as Profile;
        return profile && profile.id === input.profileId;
      });

      const result = await updateUserCurrentProfile({
        authUserId: id,
        profileId: input.profileId,
        orgId: org?.organization?.id,
      });

      if (!result.length || !result[0]) {
        throw new NotFoundError('User');
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

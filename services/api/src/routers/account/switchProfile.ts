import { invalidate } from '@op/cache';
import {
  NotFoundError,
  assertCanActAsProfile,
  updateUserCurrentProfile,
} from '@op/common';
import type { Profile } from '@op/db/schema';
import { z } from 'zod';

import { encodeUser, userEncoder } from '../../encoders';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const switchProfile = router({
  switchProfile: networkAuthenticatedProcedure()
    .input(z.object({ profileId: z.uuid() }))
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { id } = ctx.user;

      const user = await assertCanActAsProfile({
        authUserId: id,
        profileId: input.profileId,
      });

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
        throw new NotFoundError('User', id);
      }

      // Invalidate user cache since current profile/organization context has changed
      // We should wait for invalidation as we want to switch profiles immediately and want to fail if cache doesn't properly invalidate
      await invalidate({
        type: 'user',
        params: [id],
      });

      return encodeUser({ user: result[0], authUser: ctx.user });
    }),
});

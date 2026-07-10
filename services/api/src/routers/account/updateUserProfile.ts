import { invalidate } from '@op/cache';
import { updateUserProfile as updateUserProfileService } from '@op/common';

import { encodeUser, userEncoder } from '../../encoders';
import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';
import { updateUserProfileDataSchema } from '../shared/profile';

const updateUserProfile = router({
  updateUserProfile: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 3 },
  })
    .input(updateUserProfileDataSchema)
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx;

      const result = await updateUserProfileService({
        input,
        user,
      });

      // getMyAccount serves the cached user (with profile/currentProfile
      // names); without this, "Logged in as" and the comment-box placeholder
      // keep the old name until the cache expires.
      await invalidate({
        type: 'user',
        params: [user.id],
      });

      return encodeUser({ user: result, authUser: user });
    }),
});

export default updateUserProfile;

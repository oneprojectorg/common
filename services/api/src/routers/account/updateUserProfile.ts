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

      return encodeUser({ user: result, authUser: user });
    }),
});

export default updateUserProfile;

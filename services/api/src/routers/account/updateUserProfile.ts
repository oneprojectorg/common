import { updateUserProfile as updateUserProfileService } from '@op/common';

import { userEncoder } from '../../encoders';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { updateUserProfileDataSchema } from '../shared/profile';

const updateUserProfile = router({
  updateUserProfile: networkAuthenticatedProcedure({
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

      return userEncoder.parse(result);
    }),
});

export default updateUserProfile;

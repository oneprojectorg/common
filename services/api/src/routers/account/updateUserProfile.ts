import { updateUserProfile as updateUserProfileService } from '@op/common';

import { userEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import {
  handleUpdateUserProfileError,
  updateUserProfileDataSchema,
} from '../shared/profile';

const updateUserProfile = router({
  updateUserProfile: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 3 },
  })
    .input(updateUserProfileDataSchema)
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx;

      try {
        const result = await updateUserProfileService({
          input,
          user,
        });

        return userEncoder.parse(result);
      } catch (error) {
        handleUpdateUserProfileError(error);
      }
    }),
});

export default updateUserProfile;

import { updateUserProfile } from '@op/common';
import { createSBServiceClient } from '@op/supabase/server';
import { z } from 'zod';

import { userEncoder } from '../../../encoders';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../../trpcFactory';
import {
  handleUpdateUserProfileError,
  updateUserProfileDataSchema,
} from '../../shared/profile';

export const updateUserProfileRouter = router({
  updateUserProfile: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        authUserId: z.string(),
        data: updateUserProfileDataSchema,
      }),
    )
    .output(userEncoder)
    .mutation(async ({ input }) => {
      const { authUserId, data } = input;

      try {
        // Get the target user by userId (authUserId in Supabase)
        const supabase = createSBServiceClient();
        const { data: targetUserData, error } =
          await supabase.auth.admin.getUserById(authUserId);

        if (error || !targetUserData?.user) {
          throw new Error('User not found');
        }

        // Use the shared service function with the target user
        const result = await updateUserProfile({
          input: data,
          user: targetUserData.user,
        });

        return userEncoder.parse(result);
      } catch (error) {
        handleUpdateUserProfileError(error);
      }
    }),
});

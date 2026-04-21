import { NotFoundError, updateUserProfile } from '@op/common';
import { createSBServiceClient } from '@op/supabase/server';
import { z } from 'zod';

import { userEncoder } from '../../../encoders';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import { updateUserProfileDataSchema } from '../../shared/profile';

export const updateUserProfileRouter = router({
  updateUserProfile: commonProcedure
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

      const supabase = createSBServiceClient();
      const { data: targetUserData, error } =
        await supabase.auth.admin.getUserById(authUserId);

      if (error || !targetUserData?.user) {
        throw new NotFoundError('User', authUserId);
      }

      const result = await updateUserProfile({
        input: data,
        user: targetUserData.user,
      });

      return userEncoder.parse(result);
    }),
});

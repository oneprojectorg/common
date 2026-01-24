import { updateUserProfile } from '@op/common';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import { userEncoder } from '../../../encoders';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';
import {
  handleUpdateUserProfileError,
  updateUserProfileDataSchema,
} from '../../shared/profile';

export const updateUserProfileRouter = router({
  updateUserProfile: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        authUserId: z.string().uuid(),
        data: updateUserProfileDataSchema,
      }),
    )
    .output(userEncoder)
    .mutation(async ({ input }) => {
      const { authUserId, data } = input;

      try {
        // The updateUserProfile function only needs user.id to look up by authUserId
        // We don't need to fetch from Supabase auth - just pass the authUserId directly
        const result = await updateUserProfile({
          input: data,
          user: { id: authUserId } as User,
        });

        return userEncoder.parse(result);
      } catch (error) {
        handleUpdateUserProfileError(error);
      }
    }),
});

import { updateUserProfile as updateUserProfileService } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { userEncoder } from '../../encoders';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import {
  handleUpdateUserProfileError,
  updateUserProfileDataSchema,
} from '../shared/profile';

const endpoint = 'updateUserProfile';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Update user profile',
  },
};

const updateUserProfile = router({
  updateUserProfile: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
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

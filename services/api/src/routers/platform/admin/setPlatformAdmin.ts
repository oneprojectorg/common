import { NotFoundError, setPlatformAdmin } from '@op/common';
import { createSBServiceClient } from '@op/supabase/server';
import { z } from 'zod';

import { encodeUser, userEncoder } from '../../../encoders';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

export const setPlatformAdminRouter = router({
  setPlatformAdmin: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        authUserId: z.string(),
        isPlatformAdmin: z.boolean(),
      }),
    )
    .output(userEncoder)
    .mutation(async ({ input, ctx }) => {
      const { authUserId, isPlatformAdmin } = input;

      const supabase = createSBServiceClient();
      const { data: targetUserData, error } =
        await supabase.auth.admin.getUserById(authUserId);

      if (error || !targetUserData?.user) {
        throw new NotFoundError('User', authUserId);
      }

      const user = await setPlatformAdmin({
        targetAuthUserId: authUserId,
        isPlatformAdmin,
        actorAuthUserId: ctx.user.id,
      });

      return encodeUser({ user, authUser: targetUserData.user });
    }),
});

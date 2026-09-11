import { getNetworkMembership, getUser, getUserGlobalRoles } from '@op/common';
import { getGlobalPermissions } from 'access-zones';
import { z } from 'zod';

import { adminUserEncoder } from '../../../encoders/';
import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

export const getUserRouter = router({
  getUser: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(z.object({ authUserId: z.uuid() }))
    .output(adminUserEncoder)
    .query(async ({ input }) => {
      const { authUserId } = input;
      const user = await getUser({ authUserId });

      // Email is authoritative on auth.users, not public.users.
      const email = user.authUser?.email ?? null;

      const [isNetworkMember, globalRoles] = await Promise.all([
        getNetworkMembership(email),
        getUserGlobalRoles({ user: { id: authUserId } }),
      ]);

      return adminUserEncoder.parse({
        ...user,
        email,
        isAnonymous: Boolean(user.authUser?.isAnonymous),
        lastSignInAt: user.authUser?.lastSignInAt ?? null,
        isNetworkMember,
        access: getGlobalPermissions({ id: authUserId, roles: globalRoles }),
      });
    }),
});

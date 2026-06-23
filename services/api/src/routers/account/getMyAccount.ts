import { cache } from '@op/cache';
import { CommonError, getUserByAuthId } from '@op/common';
import { z } from 'zod';

import { encodeUser, userEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';
import { getNetworkMembership } from '../../utils/networkMembership';

export const getMyAccount = router({
  getMyAccount: openProcedure()
    .input(z.undefined())
    .output(userEncoder.nullable())
    .query(async ({ ctx }) => {
      // No session → no account. Anonymous sign-ins do have one (the signup
      // trigger creates a users row for every auth user), so they fall through.
      if (!ctx.user) {
        return null;
      }

      const { id } = ctx.user;

      // Fetch the account and its closed-network ("walled garden") membership
      // concurrently — both are independent, cached lookups. Membership is
      // derived from the resolved identity so RSC/client can gate off the account.
      const [user, isNetworkMember] = await Promise.all([
        cache({
          type: 'user',
          params: [id],
          fetch: async () => {
            return await getUserByAuthId({
              authUserId: id,
              includePermissions: true,
            });
          },
          options: {
            skipMemCache: true,
          },
        }),
        getNetworkMembership(ctx.user.email),
      ]);

      if (!user) {
        // This should never happen, but if it does throw an error so we can investigate.
        throw new CommonError('Common user not found');
      }

      return encodeUser({ user, authUser: ctx.user, isNetworkMember });
    }),
});

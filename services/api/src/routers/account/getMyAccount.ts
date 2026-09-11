import { cache } from '@op/cache';
import {
  CommonError,
  getNetworkMembership,
  getUserByAuthId,
  getUserGlobalRoles,
} from '@op/common';
import { getGlobalPermissions } from 'access-zones';
import { z } from 'zod';

import { encodeUser, userEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';

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

      // Read fresh: the cached account entry lives for 72h.
      const [user, isNetworkMember, globalRoles] = await Promise.all([
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
        getUserGlobalRoles({ user: { id } }),
      ]);

      if (!user) {
        // This should never happen, but if it does throw an error so we can investigate.
        throw new CommonError('Common user not found');
      }

      return encodeUser({
        user: {
          ...user,
          access: getGlobalPermissions({ id, roles: globalRoles }),
        },
        authUser: ctx.user,
        isNetworkMember,
      });
    }),
});

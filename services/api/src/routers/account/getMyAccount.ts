import { cache } from '@op/cache';
import {
  CommonError,
  getNetworkMembership,
  getUserByAuthId,
  isPlatformAdminCached,
} from '@op/common';
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

      // Account, network membership and the platform-admin flag are
      // independent cached lookups.
      const [user, isNetworkMember, isPlatformAdmin] = await Promise.all([
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
        // Resolved separately rather than read off the cached account above.
        // That entry lives for 72h and nothing invalidates the platform-admin
        // flag, which an operator changes by direct SQL; entries written before
        // the column existed don't carry it at all. This read has its own
        // 5-minute TTL, so a grant or revocation reaches the admin layout in
        // minutes — and the API gate behind that layout doesn't cache at all.
        isPlatformAdminCached({ authUserId: id }),
      ]);

      if (!user) {
        // This should never happen, but if it does throw an error so we can investigate.
        throw new CommonError('Common user not found');
      }

      // Spread over the (possibly stale-shaped) cached row so the encoded
      // account always carries the authoritative flag.
      return encodeUser({
        user: { ...user, isPlatformAdmin },
        authUser: ctx.user,
        isNetworkMember,
      });
    }),
});

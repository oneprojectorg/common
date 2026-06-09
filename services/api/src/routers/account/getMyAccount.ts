import { cache } from '@op/cache';
import { CommonError, createUserByAuthId, getUserByAuthId } from '@op/common';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';

export const getMyAccount = router({
  getMyAccount: openProcedure()
    .input(z.undefined())
    .output(userEncoder.nullable())
    .query(async ({ ctx }) => {
      // Public callers (no session) and anonymous sign-ins have no real
      // account. Resolve to `null` instead of rejecting so public pages can
      // render for non-users and anonymous visitors alike — authorization for
      // anything they touch is enforced at the service layer.
      if (!ctx.user || ctx.user.is_anonymous) {
        return null;
      }

      const { id, email } = ctx.user;

      const user = await cache({
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
      });

      if (!user) {
        // No account row yet. A confirmed session carrying an email gets one
        // created on first read; anything else resolves to no account.
        if (!email) {
          return null;
        }

        const newUserWithRelations = await createUserByAuthId({
          authUserId: id,
          email,
        });

        if (!newUserWithRelations) {
          throw new CommonError('Could not create user');
        }

        return userEncoder.parse(newUserWithRelations);
      }

      return userEncoder.parse(user);
    }),
});

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
      // No session → no account. Anonymous sign-ins do have one (the signup
      // trigger creates a users row for every auth user), so they fall through.
      if (!ctx.user) {
        return null;
      }

      const { id } = ctx.user;

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
        // if there is no user but the user is authenticated, create one
        const newUserWithRelations = await createUserByAuthId({
          authUserId: id,
          email: ctx.user.email!,
        });

        if (!newUserWithRelations) {
          throw new CommonError('Could not create user');
        }

        return userEncoder.parse(newUserWithRelations);
      }

      return userEncoder.parse(user);
    }),
});

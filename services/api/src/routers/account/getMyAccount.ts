import { cache } from '@op/cache';
import {
  CommonError,
  NotFoundError,
  createUserByAuthId,
  getUserByAuthId,
} from '@op/common';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

export const getMyAccount = router({
  getMyAccount: commonAuthedProcedure()
    .input(z.undefined())
    .output(userEncoder)
    .query(async ({ ctx }) => {
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
        if (!email) {
          throw new NotFoundError('Could not find user');
        }

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

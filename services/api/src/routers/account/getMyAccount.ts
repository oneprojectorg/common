import { cache } from '@op/cache';
import {
  CommonError,
  NotFoundError,
  createUserByAuthId,
  getUserByAuthId,
} from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account`,
    protect: true,
    tags: ['account'],
    summary: 'Get user profile',
  },
};

export const getMyAccount = router({
  getMyAccount: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
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
      });

      // const user = await getUserByAuthId({
      // authUserId: id,
      // includePermissions: true,
      // });

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

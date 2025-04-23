import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

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
    .use(withDB)
    // Router
    .meta(meta)
    .input(z.undefined())
    .output(userEncoder)
    .query(async ({ ctx }) => {
      const { db } = ctx.database;
      const { id } = ctx.user;

      const result = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.authUserId, id),
      });

      if (!result) {
        throw new TRPCError({
          message: 'User not found',
          code: 'NOT_FOUND',
        });
      }

      return result;
    }),
});

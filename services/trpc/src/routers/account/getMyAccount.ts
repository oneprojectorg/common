import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
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
        with: {
          avatarImage: true,
          organizationUsers: true,
          currentOrganization: {
            with: {
              avatarImage: true,
            },
          },
        },
      });

      if (!result) {
        throw new TRPCError({
          message: 'User not found',
          code: 'NOT_FOUND',
        });
      }

      return userEncoder.parse(result);
    }),
});

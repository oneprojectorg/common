import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { userEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const endpoint = 'getUserProfile';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Get user profile',
  },
};

const getUserProfile = router({
  getUserProfile: loggedProcedure
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

      const result = await db.query.organizationUsers.findFirst({
        where: (table, { eq }) => eq(table.id, id),
      });

      if (!result) {
        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }

      return result;
    }),
});

export default getUserProfile;

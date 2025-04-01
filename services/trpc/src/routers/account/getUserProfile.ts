import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { profiles } from '@op/db/schema';

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

const outputSchema = createSelectSchema(profiles);

const getUserProfile = router({
  getUserProfile: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(z.undefined())
    .output(outputSchema.nullable())
    .query(async ({ ctx }) => {
      const { db } = ctx.database;
      const { id } = ctx.user;

      const result = await db.query.profiles.findFirst({
        where: (table, { eq }) => eq(table.id, id),
      });

      return result || null;
    }),
});

export default getUserProfile;

import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { profiles } from '@op/db/schema';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const endpoint = 'usernameAvailable';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Check if username is available',
  },
};

const usernameAvailable = router({
  usernameAvailable: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      z.object({
        username: z
          .string()
          .max(255)
          .regex(/^$|^[a-z0-9_]+$/),
      }),
    )
    .output(z.object({
      available: z.boolean(),
    }))
    .query(async ({ input, ctx }) => {
      const { db } = ctx.database;
      const { username } = input;

      if (username === '') {
        return {
          available: true,
        };
      }

      const result = await db
        .select({
          exists: sql<boolean>`true`,
        })
        .from(profiles)
        .where(and(eq(profiles.username, username), ne(profiles.id, ctx.user.id)))
        .limit(1);

      if (!result.length || !result[0]) {
        return {
          available: true,
        };
      }

      return {
        available: false,
      };
    }),
});

export default usernameAvailable;

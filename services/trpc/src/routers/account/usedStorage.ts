import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { usersUsedStorage } from '@op/db/schema';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const endpoint = 'usedStorage';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: `/account/${endpoint}`,
    protect: true,
    tags: ['account'],
    summary: 'Get total used storage for the user',
  },
};

const usedStorage = router({
  usedStorage: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(z.undefined())
    .output(z.object({
      usedStorage: z.number(),
      maxStorage: z.literal(4000000000),
    }))
    .query(async ({ ctx }) => {
      const { db } = ctx.database;

      const result = await db
        .select()
        .from(usersUsedStorage)
        .where(and(eq(usersUsedStorage.userId, ctx.user.id)))
        .limit(1);

      if (!result.length || !result[0]) {
        return {
          usedStorage: 0,
          maxStorage: 4000000000,
        };
      }

      return {
        usedStorage: Number.parseInt(result[0].totalSize as string),
        maxStorage: 4000000000,
      };
    }),
});

export default usedStorage;

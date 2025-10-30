import { cache } from '@op/cache';
import { searchProfiles } from '@op/common';
import { EntityType } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { searchProfilesResultEncoder } from '../../encoders/searchResults';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/profile/search',
    protect: true,
    tags: ['profile'],
    summary: 'Search profiles',
  },
};

export const searchProfilesRouter = router({
  search: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(
      dbFilter.extend({
        q: z.string(),
        types: z.array(z.enum(EntityType)).optional(),
      }),
    )
    .output(searchProfilesResultEncoder)
    .query(async ({ ctx, input }) => {
      const { q, limit = 10, types } = input;

      const result = await cache<ReturnType<typeof searchProfiles>>({
        type: 'search',
        params: [q, ctx.user.id, types],
        options: {
          ttl: 30 * 1000,
        },
        fetch: () =>
          searchProfiles({
            query: q,
            limit,
            user: ctx.user,
            types,
          }),
      });

      if (!result) {
        throw new TRPCError({
          message: 'Profiles not found',
          code: 'NOT_FOUND',
        });
      }

      return result;
    }),
});

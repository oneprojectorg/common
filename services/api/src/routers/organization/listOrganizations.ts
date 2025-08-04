import { listOrganizations } from '@op/common';
import { EntityType } from '@op/db/schema';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization',
    protect: true,
    tags: ['organization'],
    summary: 'List organizations',
  },
};

export const listOrganizationsRouter = router({
  list: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
    .input(
      dbFilter
        .extend({
          terms: z.array(z.string()).nullish(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(organizationsWithProfileEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit = 10, cursor, orderBy, dir } = input ?? {};

      const { items, next, hasMore } = await listOrganizations({
        cursor,
        user: ctx.user,
        limit,
        orderBy,
        dir,
      });

      return {
        items: items.map((org) => organizationsWithProfileEncoder.parse(org)),
        next,
        hasMore,
      };
    }),
});

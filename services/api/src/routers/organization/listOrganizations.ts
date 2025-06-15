import { listOrganizations } from '@op/common';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
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
          cursor: z.string().nullish(),
        })
        .optional(),
    )
    .output(
      z.object({
        items: z.array(organizationsEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit = 10, cursor } = input ?? {};

      const { items, next, hasMore } = await listOrganizations({
        cursor,
        user: ctx.user,
        limit,
      });

      return {
        items: items.map((org) => organizationsEncoder.parse(org)),
        next,
        hasMore,
      };
    }),
});

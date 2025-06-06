import { searchOrganizations } from '@op/common';
import { TRPCError } from '@trpc/server';
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
    path: '/organization/search',
    protect: true,
    tags: ['organization'],
    summary: 'Search organizations',
  },
};

export const searchOrganizationsRouter = router({
  search: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
    .input(
      dbFilter.extend({
        q: z.string(),
      }),
    )
    .output(z.array(organizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { q, limit = 10 } = input;

      const result = await searchOrganizations({
        query: q,
        limit,
        user: ctx.user,
      });

      if (!result) {
        throw new TRPCError({
          message: 'Organizations not found',
          code: 'NOT_FOUND',
        });
      }

      return result.map((org) => organizationsEncoder.parse(org));
    }),
});

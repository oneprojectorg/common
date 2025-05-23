import { sql } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
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
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      dbFilter.extend({
        q: z.string(),
      }),
    )
    .output(z.array(organizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { q, limit = 10 } = input;
      if (q === '') {
        return [];
      }

      const where = sql`${organizations.name} @@to_tsquery('english', ${q.trim() + ':*'})`;

      // TODO: assert authorization, setup a common package
      const result = await db.query.organizations.findMany({
        with: {
          projects: true,
          links: true,
          headerImage: true,
          avatarImage: true,
        },
        orderBy: (orgs, { desc }) => desc(orgs.updatedAt),
        limit,
        where,
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

import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
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
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      dbFilter
        .extend({
          terms: z.array(z.string()).nullish(),
        })
        .optional(),
    )
    .output(z.array(organizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { limit = 10, terms = [] } = input ?? {};

      if (terms?.length) {
        const result = await db.query.organizationsTerms.findMany({
          where: (table) => inArray(table.taxonomyTermId, terms),
          // with: {
          // organization: {
          // // links: true,
          // headerImage: true,
          // avatarImage: true,
          // },
          // },
        });

        console.log('TERMS', terms, result);
        const orgs = await db.query.organizations.findMany({
          where: (table) =>
            inArray(
              table.id,
              result.map((r) => r.organizationId),
            ),
          with: {
            projects: true,
            links: true,
            headerImage: true,
            avatarImage: true,
          },
          orderBy: (orgs, { desc }) => desc(orgs.updatedAt),
          limit,
        });

        return orgs.map((org) => organizationsEncoder.parse(org));
      }

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

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const inputSchema = z.object({
  organizationId: z.string().uuid(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{organizationId}',
    protect: true,
    tags: ['organization'],
    summary: 'Get organization by slug',
  },
};

export const getOrganizationRouter = router({
  getById: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsEncoder)
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { organizationId } = input;

      // TODO: assert authorization, setup a common package
      const result = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.id, organizationId),
        with: {
          projects: true,
        },
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

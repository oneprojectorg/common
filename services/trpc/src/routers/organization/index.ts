import { z } from 'zod';

import { organizationEncoder } from '../../encoders/organization';
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
    summary: 'Get organization by ID',
  },
};

const organizationRouter = router({
  getById: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationEncoder)
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { organizationId } = input;

      // TODO: check authorization, setup a common package
      const result = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.id, organizationId),
      });

      return result || null;
    }),
});

export default organizationRouter;

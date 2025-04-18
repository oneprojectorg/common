import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getOrganization } from '@op/common';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const inputSchema = z.object({
  slug: z.string(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{slug}',
    protect: true,
    tags: ['organization'],
    summary: 'Get organization',
  },
};

export const getOrganizationRouter = router({
  getBySlug: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsEncoder)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { user } = ctx;

      const result = await getOrganization({ slug, user });

      console.log('RETURNING', result);

      if (!result) {
        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }

      return result;
    }),
});

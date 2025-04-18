import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getOrganization, UnauthorizedError } from '@op/common';

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

      try {
        const result = await getOrganization({ slug, user });

        if (!result) {
          throw new TRPCError({
            message: 'Organization not found',
            code: 'NOT_FOUND',
          });
        }

        return result;
      }
      catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have acess to this organization',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});

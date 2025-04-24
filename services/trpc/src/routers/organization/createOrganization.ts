import { TRPCError } from '@trpc/server';

import { createOrganization, UnauthorizedError } from '@op/common';

import {
  organizationsCreateInputEncoder,
  organizationsEncoder,
} from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const inputSchema = organizationsCreateInputEncoder;

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization',
    protect: true,
    tags: ['organization'],
    summary: 'Create organization',
  },
};

export const createOrganizationRouter = router({
  create: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        const org = await createOrganization({ data: input, user });

        return org;
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to create organizations',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to create organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

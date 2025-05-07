import { UnauthorizedError, getRelationship } from '@op/common';
import { getSession } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  // from: z.string().uuid({ message: 'Invalid source organization ID' }),
  to: z.string().uuid({ message: 'Invalid target organization ID' }),
  pending: z.boolean().optional(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{from}/relationships/{to}',
    protect: true,
    tags: ['organization', 'relationships'],
    summary: 'List organization relationships to another organization',
  },
};

export const listRelationshipsRouter = router({
  listRelationships: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(inputSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;
      const { to, pending } = input;

      try {
        const session = await getSession();
        if (!session) {
          throw new UnauthorizedError('No user found');
        }

        const { records: relationships, count } = await getRelationship({
          user,
          from: session.user.lastOrgId,
          to,
          pending,
        });

        return { relationships, count };
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Could not retrieve relationships',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

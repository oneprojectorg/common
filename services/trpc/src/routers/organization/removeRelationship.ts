import {
  UnauthorizedError,
  removeRelationship,
} from '@op/common';
import { getSession } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  id: z.string().uuid({ message: 'Invalid ID' }),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/organization/{from}/relationship/{id}',
    protect: true,
    tags: ['organization'],
    summary: 'Remove organization relationship',
  },
};

export const removeRelationshipRouter = router({
  removeRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(inputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { id } = input;

      try {
        const session = await getSession();
        if (!session) {
          throw new UnauthorizedError('Unauthorized access');
        }

        await removeRelationship({
          user,
          id,
        });

        return { success: true };
      } catch (error: unknown) {
        console.log('ERROR', error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Failed to remove relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

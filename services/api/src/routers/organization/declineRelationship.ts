import { UnauthorizedError, declineRelationship } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withAnalytics from '../../middlewares/withAnalytics';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z
    .string()
    .uuid({ message: 'Invalid target organization ID' }),
  ids: z.array(z.string()),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization/{targetOrganizationId}/relationships/decline',
    protect: true,
    tags: ['organization', 'relationships'],
    summary: 'Decline an organizations relationships',
  },
};

export const declineRelationshipRouter = router({
  declineRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .output(z.boolean())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { ids, targetOrganizationId } = input;

      try {
        if (!user) {
          throw new UnauthorizedError('No user found');
        }

        await declineRelationship({
          user,
          targetOrganizationId,
          ids,
        });

        return true;
      } catch (error: unknown) {
        console.log('ERROR', error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'UNAUTHORIZED',
          });
        }
        throw new TRPCError({
          message: 'Could not decline relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

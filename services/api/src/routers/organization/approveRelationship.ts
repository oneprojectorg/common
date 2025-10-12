import { UnauthorizedError, approveRelationship } from '@op/common';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { trackRelationshipAccepted } from '../../utils/analytics';

const inputSchema = z.object({
  targetOrganizationId: z.uuid({
    error: 'Invalid target organization ID',
  }),
  sourceOrganizationId: z.uuid({
    error: 'Invalid organization ID',
  }),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization/{targetOrganizationId}/relationships/approve',
    protect: true,
    tags: ['organization', 'relationships'],
    summary: 'Approve an organizations relationships',
  },
};

export const approveRelationshipRouter = router({
  approveRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .output(z.boolean())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { targetOrganizationId, sourceOrganizationId } = input;

      try {
        if (!user) {
          throw new UnauthorizedError('No user found');
        }

        await approveRelationship({
          user,
          targetOrganizationId,
          sourceOrganizationId,
        });

        // Track analytics (non-blocking)
        waitUntil(trackRelationshipAccepted(ctx));

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
          message: 'Could not approve relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

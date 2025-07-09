import { UnauthorizedError, approveRelationship } from '@op/common';
import { getSession } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';
import { trackRelationshipAccepted } from '@op/analytics';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z
    .string()
    .uuid({ message: 'Invalid target organization ID' }),
  sourceOrganizationId: z.string().uuid({ message: 'Invalid organization ID' }),
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
    .meta(meta)
    .input(inputSchema)
    .output(z.boolean())
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { targetOrganizationId, sourceOrganizationId } = input;

      try {
        const session = await getSession();
        if (!session) {
          throw new UnauthorizedError('No user found');
        }

        await approveRelationship({
          user,
          targetOrganizationId,
          sourceOrganizationId,
        });

        // Track analytics (non-blocking)
        waitUntil(trackRelationshipAccepted(user.id));

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

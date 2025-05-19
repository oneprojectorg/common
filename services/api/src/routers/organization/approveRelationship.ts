import { UnauthorizedError, approveRelationship } from '@op/common';
import { getSession } from '@op/common/src/services/access';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z
    .string()
    .uuid({ message: 'Invalid target organization ID' }),
  organizationId: z.string().uuid({ message: 'Invalid organization ID' }),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization/{organizationId}/relationships/{relationshipId}/approve',
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
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { targetOrganizationId, organizationId } = input;

      try {
        const session = await getSession();
        if (!session) {
          throw new UnauthorizedError('No user found');
        }

        await approveRelationship({
          user,
          targetOrganizationId,
          organizationId,
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
          message: 'Could not approve relationship',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

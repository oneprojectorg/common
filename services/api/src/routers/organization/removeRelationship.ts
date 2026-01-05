import { Channels, UnauthorizedError, removeRelationship } from '@op/common';
import { db, eq } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  id: z.uuid({
    error: 'Invalid ID',
  }),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/organization/relationship/{id}',
    protect: true,
    tags: ['organization'],
    summary: 'Remove organization relationship',
  },
};

export const removeRelationshipRouter = router({
  removeRelationship: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      const { id } = input;

      try {
        // Run lookup and remove in parallel - lookup is only for channel registration
        const [relationship] = await Promise.all([
          db.query.organizationRelationships.findFirst({
            where: eq(organizationRelationships.id, id),
            columns: {
              sourceOrganizationId: true,
              targetOrganizationId: true,
            },
          }),
          removeRelationship({
            user,
            id,
          }),
        ]);

        // Register channels for query invalidation
        if (relationship) {
          ctx.registerMutationChannels([
            Channels.orgRelationship({
              type: 'from',
              orgId: relationship.sourceOrganizationId,
            }),
            Channels.orgRelationship({
              type: 'to',
              orgId: relationship.targetOrganizationId,
            }),
          ]);
        }

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

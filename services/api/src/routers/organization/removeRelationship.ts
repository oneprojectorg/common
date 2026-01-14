import { Channels, UnauthorizedError, removeRelationship } from '@op/common';
import { Organization } from '@op/db/schema';
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
      const { id } = input;

      try {
        const relationshipRemoved = await removeRelationship({
          id,
        });

        const sourceOrgId = relationshipRemoved.sourceOrganizationId;
        const targetOrgId = relationshipRemoved.targetOrganizationId;

        ctx.registerMutationChannels([
          Channels.profileRelationshipRequest({
            type: 'source',
            orgId: sourceOrgId,
          }),
          Channels.profileRelationshipRequest({
            type: 'target',
            orgId: targetOrgId,
          }),
        ]);

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

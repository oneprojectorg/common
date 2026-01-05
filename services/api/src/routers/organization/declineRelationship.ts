import { Channels, UnauthorizedError, declineRelationship } from '@op/common';
import { db, inArray } from '@op/db/client';
import { organizationRelationships } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  targetOrganizationId: z.uuid({
    error: 'Invalid target organization ID',
  }),
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
        // Run lookup and decline in parallel - lookup is only for channel registration
        const [relationships] = await Promise.all([
          db.query.organizationRelationships.findMany({
            where: inArray(organizationRelationships.id, ids),
            columns: {
              sourceOrganizationId: true,
            },
          }),
          declineRelationship({
            user,
            targetOrganizationId,
            ids,
          }),
        ]);

        // Register channels for query invalidation
        const channels = [
          Channels.orgRelationship({ type: 'to', orgId: targetOrganizationId }),
        ];
        // Add source org channels for all affected relationships
        const sourceOrgIds = [
          ...new Set(relationships.map((r) => r.sourceOrganizationId)),
        ];
        for (const sourceOrgId of sourceOrgIds) {
          channels.push(
            Channels.orgRelationship({ type: 'from', orgId: sourceOrgId }),
          );
        }
        ctx.registerMutationChannels(channels);

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

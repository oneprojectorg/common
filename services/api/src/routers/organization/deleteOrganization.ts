import { deleteOrganization } from '@op/common';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.uuid(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/organization/{organizationId}',
    protect: true,
    tags: ['organization'],
    summary: 'Delete organization',
  },
};

export const deleteOrganizationRouter = router({
  deleteOrganization: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 60, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = input;
      const { user } = ctx;

      try {
        const deletedOrganization = await deleteOrganization({
          organizationId,
          user,
        });

        return organizationsEncoder.parse(deletedOrganization);
      } catch (error: unknown) {
        logger.error('Error deleting organization', {
          error,
          organizationId,
        });

        if (error instanceof Error) {
          if (error.name === 'UnauthorizedError') {
            throw new TRPCError({
              message: error.message,
              code: 'UNAUTHORIZED',
            });
          }
          if (error.name === 'NotFoundError') {
            throw new TRPCError({
              message: error.message,
              code: 'NOT_FOUND',
            });
          }
          if (error.name === 'AccessError') {
            throw new TRPCError({
              message: 'You do not have permission to delete organizations',
              code: 'UNAUTHORIZED',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to delete organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

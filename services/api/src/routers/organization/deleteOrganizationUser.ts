import { deleteOrganizationUser } from '@op/common';
import { logger } from '@op/logging';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.uuid(),
  organizationUserId: z.uuid(),
});

const outputSchema = z.object({
  id: z.string(),
  authUserId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  about: z.string().nullable(),
  organizationId: z.string(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/organization/{organizationId}/user/{organizationUserId}',
    protect: true,
    tags: ['organization'],
    summary: 'Delete organization user',
  },
};

export const deleteOrganizationUserRouter = router({
  deleteOrganizationUser: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 60, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, organizationUserId } = input;
      const { user } = ctx;

      try {
        const deletedUser = await deleteOrganizationUser({
          organizationUserId,
          organizationId,
          user,
        });

        return outputSchema.parse(deletedUser);
      } catch (error: unknown) {
        logger.error('Error deleting organization user', {
          error,
          organizationUserId,
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
              message:
                'You do not have permission to delete organization users',
              code: 'UNAUTHORIZED',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to delete organization user',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

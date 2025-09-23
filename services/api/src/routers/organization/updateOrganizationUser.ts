import { updateOrganizationUser } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withAnalytics from '../../middlewares/withAnalytics';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.string().uuid(),
  organizationUserId: z.string().uuid(),
  data: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    about: z.string().optional(),
    roleIds: z.array(z.string().uuid()).optional(),
  }),
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
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    })
  ),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PATCH',
    path: '/organization/{organizationId}/user/{organizationUserId}',
    protect: true,
    tags: ['organization'],
    summary: 'Update organization user',
  },
};

export const updateOrganizationUserRouter = router({
  updateOrganizationUser: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, organizationUserId, data } = input;
      const { user } = ctx;

      try {
        const updatedUser = await updateOrganizationUser({
          organizationUserId,
          organizationId,
          data,
          user,
        });

        return outputSchema.parse(updatedUser);
      } catch (error: unknown) {
        console.error('Error updating organization user:', error);

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
              message: 'You do not have permission to update organization users',
              code: 'UNAUTHORIZED',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to update organization user',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
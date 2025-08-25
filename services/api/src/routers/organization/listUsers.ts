import { getOrganizationUsers } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
});

const organizationUserEncoder = z.object({
  id: z.string(),
  authUserId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  about: z.string().nullable(),
  organizationId: z.string(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
  profile: z.object({
    id: z.string(),
    name: z.string().nullable(),
    slug: z.string(),
    bio: z.string().nullable(),
    type: z.string(),
    avatarImage: z.object({
      id: z.string(),
      name: z.string().nullable(),
    }).nullable(),
  }).nullable(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{profileId}/users',
    protect: true,
    tags: ['organization'],
    summary: 'List organization users',
  },
};

export const listUsersRouter = router({
  listUsers: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(z.array(organizationUserEncoder))
    .query(async ({ ctx, input }) => {
      const { profileId } = input;
      const { user } = ctx;

      try {
        const users = await getOrganizationUsers({
          profileId,
          user,
        });

        return users.map((user) => organizationUserEncoder.parse(user));
      } catch (error: unknown) {
        console.error('Error listing organization users:', error);

        if (error instanceof Error) {
          if (
            error.message.includes('not a member') ||
            error.message.includes('Unauthorized')
          ) {
            throw new TRPCError({
              message: 'You do not have permission to view organization users',
              code: 'UNAUTHORIZED',
            });
          }
          if (error.message.includes('not found')) {
            throw new TRPCError({
              message: 'Organization not found',
              code: 'NOT_FOUND',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to retrieve organization users',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});

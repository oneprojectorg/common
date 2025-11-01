import {
  UnauthorizedError,
  deletePostById,
  getOrgAccessUser,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/profile/{profileId}/posts/{id}',
    protect: true,
    tags: ['profile', 'post'],
    summary: 'Delete a post from an organization',
    description: 'Delete a post from an organization',
  },
};

export const deletePost = router({
  deletePost: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(
      z.object({
        id: z.string().describe('The ID of the post to delete'),
        profileId: z
          .string()
          .describe('The ID of the profile the post belongs to'),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { id, profileId } = input;

      // Look up the organization by profileId for access control
      const organization = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.profileId, profileId))
        .limit(1);

      if (!organization.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organization not found for the specified profileId',
        });
      }

      const organizationId = organization[0]!.id;

      const user = await getOrgAccessUser({
        organizationId,
        user: ctx.user,
      });

      if (!user) {
        throw new UnauthorizedError();
      }

      try {
        return await deletePostById({ postId: id, organizationId });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Post not found')
        ) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});

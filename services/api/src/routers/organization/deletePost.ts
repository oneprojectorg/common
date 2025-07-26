import { UnauthorizedError, getOrgAccessUser, deletePostById } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/organization/{organizationId}/posts/{id}',
    protect: true,
    tags: ['organization', 'post'],
    summary: 'Delete a post from an organization',
    description: 'Delete a post from an organization',
  },
};

export const deletePost = router({
  deletePost: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 5 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(
      z.object({
        id: z.string().describe('The ID of the post to delete'),
        organizationId: z
          .string()
          .describe('The ID of the organization the post belongs to'),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { id, organizationId } = input;

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
        if (error instanceof Error && error.message.includes('Post not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});

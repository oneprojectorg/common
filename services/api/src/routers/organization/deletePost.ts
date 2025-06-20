import { UnauthorizedError, getOrgAccessUser } from '@op/common';
import { posts, postsToOrganizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
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
    .use(withDB)
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
      const { db } = ctx.database;

      const user = await getOrgAccessUser({
        organizationId,
        user: ctx.user,
      });

      if (!user) {
        throw new UnauthorizedError();
      }

      // Verify the post exists and belongs to the organization
      const postExists = await db
        .select()
        .from(posts)
        .innerJoin(
          postsToOrganizations,
          eq(posts.id, postsToOrganizations.postId),
        )
        .where(
          and(
            eq(posts.id, id),
            eq(postsToOrganizations.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!postExists.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Post not found or does not belong to the specified organization',
        });
      }

      await db.delete(posts).where(eq(posts.id, id));

      return { success: true };
    }),
});

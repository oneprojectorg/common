import { TRPCError } from '@trpc/server';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { postsToOrganizations, posts } from '@op/db/schema';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization/{id}/posts',
    protect: true,
    tags: ['organization', 'post'],
    summary: 'Add a post to an organization',
  },
};

const outputSchema = createSelectSchema(posts);

export const addPostToOrganization = router({
  addPostToOrganization: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 3 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(
      z.object({
        id: z.string(),
        content: z.string().trim().max(255),
      }),
    )
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;
      // const { id } = ctx.user;

      try {
        const newPost = await db.transaction(async (tx) => {
          const insertedPosts = await tx
            .insert(posts)
            .values({
              content: input.content,
            })
            .returning();

          const post = insertedPosts[0];

          if (!post) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to add post to organization',
            });
          }

          // Create the join record associating the post with the organization
          await tx.insert(postsToOrganizations).values({
            organizationId: input.id,
            postId: post.id,
          });

          return post;
        });

        return newPost;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add post to organization',
        });
      }
    }),
});

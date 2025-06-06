import { UnauthorizedError, getOrgAccessUser } from '@op/common';
import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

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

const outputSchema = postsEncoder.strip();

export const createPostInOrganization = router({
  createPost: loggedProcedure
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
        attachmentIds: z.array(z.string()).optional().default([]),
      }),
    )
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;

      const user = await getOrgAccessUser({
        organizationId: input.id,
        user: ctx.user,
      });

      if (!user) {
        throw new UnauthorizedError();
      }

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

          const allStorageObjects = await tx.query.objectsInStorage.findMany({
            where: (table, { inArray }) =>
              inArray(table.id, input.attachmentIds),
          });

          // Create attachment records if any attachments were uploaded
          if (allStorageObjects.length > 0) {
            const attachmentValues = allStorageObjects.map((storageObject) => ({
              postId: post.id,
              storageObjectId: storageObject.id,
              uploadedBy: user.id,
              fileName:
                // @ts-expect-error - We check for this existence first. TODO: find the source of this TS error
                storageObject?.name
                  ?.split('/')
                  .slice(-1)[0]
                  .split('_')
                  .slice(1)
                  .join('_') ?? '',
              mimeType: (storageObject.metadata as { mimetype: string })
                .mimetype,
            }));

            // @ts-ignore
            await tx.insert(attachments).values(attachmentValues);
          }

          return post;
        });

        const output = outputSchema.parse(newPost);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add post to organization',
        });
      }
    }),
});

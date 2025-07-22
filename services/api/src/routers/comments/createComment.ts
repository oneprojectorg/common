import { getCurrentProfileId } from '@op/common';
import { comments } from '@op/db/schema';
import { createCommentSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { commentsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/comments',
    protect: true,
    tags: ['comments'],
    summary: 'Create a comment',
  },
};

const outputSchema = commentsEncoder.strip();

export const createComment = router({
  createComment: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(createCommentSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;

      const profileId = await getCurrentProfileId();

      try {
        const [comment] = await db
          .insert(comments)
          .values({
            content: input.content,
            postId: input.postId,
            profileId,
            parentCommentId: input.parentCommentId || null,
          })
          .returning();

        if (!comment) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create comment',
          });
        }

        const output = outputSchema.parse(comment);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when creating comment',
        });
      }
    }),
});
import { getCurrentProfileId } from '@op/common';
import { comments } from '@op/db/schema';
import { updateCommentSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { commentsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'PUT',
    path: '/comments/{id}',
    protect: true,
    tags: ['comments'],
    summary: 'Update a comment',
  },
};

const outputSchema = commentsEncoder.strip();

export const updateComment = router({
  updateComment: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(updateCommentSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;

      const profileId = await getCurrentProfileId();

      try {
        const [comment] = await db
          .update(comments)
          .set({
            content: input.content,
          })
          .where(and(eq(comments.id, input.id), eq(comments.profileId, profileId)))
          .returning();

        if (!comment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Comment not found or you do not have permission to update it',
          });
        }

        const output = outputSchema.parse(comment);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when updating comment',
        });
      }
    }),
});
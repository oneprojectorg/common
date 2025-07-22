import { getCurrentProfileId } from '@op/common';
import { comments } from '@op/db/schema';
import { deleteCommentSchema } from '@op/types';
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
    path: '/comments/{id}',
    protect: true,
    tags: ['comments'],
    summary: 'Delete a comment',
  },
};

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const deleteComment = router({
  deleteComment: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(deleteCommentSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx.database;

      const profileId = await getCurrentProfileId();

      try {
        const [deletedComment] = await db
          .delete(comments)
          .where(and(eq(comments.id, input.id), eq(comments.profileId, profileId)))
          .returning();

        if (!deletedComment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Comment not found or you do not have permission to delete it',
          });
        }

        return { success: true, message: 'Comment deleted successfully' };
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when deleting comment',
        });
      }
    }),
});
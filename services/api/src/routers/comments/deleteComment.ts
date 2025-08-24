import { deleteComment as deleteCommentService } from '@op/common';
import { deleteCommentSchema } from '@op/types';
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
    .meta(meta)
    .input(deleteCommentSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await deleteCommentService({
          ...input,
          authUserId: ctx.user.id,
        });
        return result;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when deleting comment',
        });
      }
    }),
});

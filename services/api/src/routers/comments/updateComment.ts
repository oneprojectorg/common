import { updateComment as updateCommentService } from '@op/common';
import { updateCommentSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { commentsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
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
    .meta(meta)
    .input(updateCommentSchema)
    .output(outputSchema)
    .mutation(async ({ input }) => {
      try {
        const comment = await updateCommentService(input);
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

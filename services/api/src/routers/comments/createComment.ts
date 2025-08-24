import { createComment as createCommentService } from '@op/common';
import { createCommentSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { commentsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
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
    .meta(meta)
    .input(createCommentSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const comment = await createCommentService({
          ...input,
          authUserId: ctx.user.id,
        });
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

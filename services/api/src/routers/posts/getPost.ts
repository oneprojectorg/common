import { getPost as getPostService } from '@op/common';
import { getPostSchema } from '@op/types';
import { TRPCError } from '@trpc/server';

import { postsEncoder } from '../../encoders';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const outputSchema = postsEncoder;

export const getPost = router({
  getPost: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(getPostSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const post = await getPostService({
          ...input,
          authUserId: ctx.user.id,
        });

        if (!post) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Post not found',
          });
        }

        const output = outputSchema.parse(post);
        return output;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when fetching post',
        });
      }
    }),
});

import { NotFoundError, getPost as getPostService } from '@op/common';
import { getPostSchema } from '@op/types';

import { postsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = postsEncoder;

export const getPost = router({
  getPost: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(getPostSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      const post = await getPostService({
        ...input,
        authUserId: ctx.user.id,
      });

      if (!post) {
        throw new NotFoundError('Post');
      }

      return outputSchema.parse(post);
    }),
});

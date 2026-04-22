import { getPosts as getPostsService } from '@op/common';
import { getPostsSchema } from '@op/types';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const outputSchema = z.array(postsEncoder);

export const getPosts = router({
  getPosts: commonAuthedProcedure()
    .input(getPostsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      const posts = await getPostsService({
        ...input,
        authUserId: ctx.user.id,
      });
      return outputSchema.parse(posts);
    }),
});

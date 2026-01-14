import { getPosts as getPostsService } from '@op/common';
import { getPostsSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
// import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { postsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'GET',
// path: '/posts',
// protect: true,
// tags: ['posts'],
// summary: 'Get posts (with optional children/comments)',
// },
// };

const outputSchema = z.array(postsEncoder);

export const getPosts = router({
  getPosts: commonAuthedProcedure()
    .input(getPostsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      try {
        const posts = await getPostsService({
          ...input,
          authUserId: ctx.user.id,
        });
        const output = outputSchema.parse(posts);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when fetching posts',
        });
      }
    }),
});

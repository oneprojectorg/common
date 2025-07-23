import { createPost as createPostService } from '@op/common';
import { createPostSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';

import { postsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/posts',
    protect: true,
    tags: ['posts'],
    summary: 'Create a post (or comment)',
  },
};

const outputSchema = postsEncoder;

export const createPost = router({
  createPost: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .meta(meta)
    .input(createPostSchema)
    .output(outputSchema)
    .mutation(async ({ input }) => {
      try {
        const post = await createPostService(input);
        const output = outputSchema.parse(post);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when creating post',
        });
      }
    }),
});
import { createPost as createPostService } from '@op/common';
import { createPostSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';

// import type { OpenApiMeta } from 'trpc-to-openapi';

import { postsEncoder } from '../../encoders';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { trackProposalCommented } from '../../utils/analytics';

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'POST',
// path: '/posts',
// protect: true,
// tags: ['posts'],
// summary: 'Create a post (or comment)',
// },
// };

const outputSchema = postsEncoder;

export const createPost = router({
  createPost: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // .meta(meta)
    .input(createPostSchema)
    .output(outputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const post = await createPostService({
          ...input,
          authUserId: ctx.user.id,
        });

        // Track proposal commented event if this is a proposal comment
        if (input.proposalId && input.processInstanceId) {
          waitUntil(
            trackProposalCommented(
              ctx,
              input.processInstanceId,
              input.proposalId,
            ),
          );
        }

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

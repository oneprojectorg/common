import { createPost as createPostService } from '@op/common';
import { createPostSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';

import { postsEncoder } from '../../encoders';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { trackProposalCommented } from '../../utils/analytics';

const outputSchema = postsEncoder;

export const createPost = router({
  createPost: commonAuthedProcedure()
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

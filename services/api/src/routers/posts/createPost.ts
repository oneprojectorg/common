import { createPost as createPostService } from '@op/common';
import { createPostSchema } from '@op/types';
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
      const post = await createPostService({
        ...input,
        authUserId: ctx.user.id,
      });

      if (input.proposalId && input.processInstanceId) {
        waitUntil(
          trackProposalCommented(ctx, input.processInstanceId, input.proposalId),
        );
      }

      return outputSchema.parse(post);
    }),
});

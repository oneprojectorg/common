import { Channels, createPost as createPostService } from '@op/common';
import type { ChannelName } from '@op/common';
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

      const channels: ChannelName[] = [];
      if (input.profileId) {
        channels.push(Channels.profilePosts(input.profileId));
      }
      if (input.parentPostId) {
        channels.push(Channels.postComments(input.parentPostId));
      }
      if (channels.length > 0) {
        ctx.registerMutationChannels(channels);
      }

      if (input.proposalId && input.processInstanceId) {
        waitUntil(
          trackProposalCommented(
            ctx,
            input.processInstanceId,
            input.proposalId,
          ),
        );
      }

      return outputSchema.parse(post);
    }),
});

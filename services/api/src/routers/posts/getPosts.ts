import { Channels, getPosts as getPostsService } from '@op/common';
import type { ChannelName } from '@op/common';
import { list } from '@op/common/client';
import { getPostsSchema } from '@op/types';

import { postsEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';

const outputSchema = list(postsEncoder);

export const getPosts = router({
  getPosts: openProcedure()
    .input(getPostsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      const posts = await getPostsService({
        ...input,
        authUserId: ctx.user?.id,
      });

      const channels: ChannelName[] = [];
      if (input.profileId) {
        channels.push(Channels.profilePosts(input.profileId));
      }
      if (input.parentPostId) {
        channels.push(Channels.postComments(input.parentPostId));
      }
      if (channels.length > 0) {
        ctx.registerQueryChannels(channels);
      }

      return outputSchema.parse({ items: posts });
    }),
});

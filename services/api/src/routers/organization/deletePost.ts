import { Channels, deletePostById } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deletePost = router({
  deletePost: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        id: z.string().describe('The ID of the post to delete'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { parentPostId } = await deletePostById({
        postId: input.id,
        user: ctx.user,
      });

      if (parentPostId) {
        ctx.registerMutationChannels([Channels.postComments(parentPostId)]);
      }
    }),
});

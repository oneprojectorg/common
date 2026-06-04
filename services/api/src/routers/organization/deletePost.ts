import { deletePostById } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const deletePost = router({
  deletePost: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        id: z.string().describe('The ID of the post to delete'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await deletePostById({ postId: input.id, user: ctx.user });
    }),
});

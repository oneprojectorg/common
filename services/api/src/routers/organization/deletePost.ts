import { deletePostById } from '@op/common';
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
      await deletePostById({
        postId: input.id,
        user: ctx.user,
      });
    }),
});

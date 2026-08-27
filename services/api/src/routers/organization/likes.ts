import { channelsForPost, toggleLike } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const likeProcedure = networkAuthenticatedProcedure({
  rateLimit: { windowSize: 10, maxRequests: 20 },
});

export const likesRouter = router({
  toggleLike: likeProcedure
    .input(
      z.object({
        postId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId } = input;
      const { action, context } = await toggleLike({
        user: ctx.user,
        postId,
      });

      ctx.registerMutationChannels(channelsForPost(context));

      return { action };
    }),
});

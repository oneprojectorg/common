import {
  authorizeReactionForPost,
  channelsForPost,
  toggleReaction,
} from '@op/common';
import { VALID_REACTION_TYPES } from '@op/types';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const reactionTypeEnum = z.enum(VALID_REACTION_TYPES as [string, ...string[]]);

const reactionProcedure = commonAuthedProcedure({
  rateLimit: { windowSize: 10, maxRequests: 20 },
});

export const reactionsRouter = router({
  toggleReaction: reactionProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { context, profileId } = await authorizeReactionForPost({
        user: ctx.user,
        postId,
      });

      const result = await toggleReaction({ postId, profileId, reactionType });
      ctx.registerMutationChannels(channelsForPost(context));

      return result;
    }),
});

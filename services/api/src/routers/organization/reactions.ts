import {
  addReaction,
  channelsForPost,
  removeReaction,
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
  addReaction: reactionProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { context } = await addReaction({
        user: ctx.user,
        postId: input.postId,
        reactionType: input.reactionType,
      });
      ctx.registerMutationChannels(channelsForPost(context));
    }),

  removeReaction: reactionProcedure
    .input(
      z.object({
        postId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { context } = await removeReaction({
        user: ctx.user,
        postId: input.postId,
      });
      ctx.registerMutationChannels(channelsForPost(context));
    }),

  toggleReaction: reactionProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { context, action } = await toggleReaction({
        user: ctx.user,
        postId: input.postId,
        reactionType: input.reactionType,
      });
      ctx.registerMutationChannels(channelsForPost(context));
      return { action };
    }),
});

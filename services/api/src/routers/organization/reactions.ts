import {
  addReaction,
  getCurrentProfileId,
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
      const { postId, reactionType } = input;
      const { user } = ctx;

      const profileId = await getCurrentProfileId(user.id);
      await addReaction({ postId, profileId, reactionType });
    }),

  removeReaction: reactionProcedure
    .input(
      z.object({
        postId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId } = input;
      const { user } = ctx;

      const profileId = await getCurrentProfileId(user.id);
      await removeReaction({ postId, profileId });
    }),

  toggleReaction: reactionProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { user } = ctx;

      const profileId = await getCurrentProfileId(user.id);
      return await toggleReaction({ postId, profileId, reactionType });
    }),
});

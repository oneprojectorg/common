import {
  CommonError,
  addReaction,
  getCurrentProfileId,
  removeReaction,
  toggleReaction,
} from '@op/common';
import { VALID_REACTION_TYPES } from '@op/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const reactionTypeEnum = z.enum(VALID_REACTION_TYPES as [string, ...string[]]);

export const reactionsRouter = router({
  addReaction: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { user } = ctx;

      try {
        const profileId = await getCurrentProfileId(user.id);
        await addReaction({ postId, profileId, reactionType });
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add reaction',
        });
      }
    }),

  removeReaction: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
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

      return { success: true };
    }),

  toggleReaction: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { user } = ctx;

      try {
        const profileId = await getCurrentProfileId(user.id);
        return await toggleReaction({ postId, profileId, reactionType });
      } catch (e) {
        console.error(e);
        throw new CommonError('Failed to toggle reaction');
      }
    }),
});

import { getCurrentProfileId } from '@op/common';
import { postReactions } from '@op/db/schema';
import { VALID_REACTION_TYPES } from '@op/types';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const reactionTypeEnum = z.enum(VALID_REACTION_TYPES as [string, ...string[]]);

export const reactionsRouter = router({
  addReaction: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withDB)
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { database } = ctx;

      try {
        const profileId = await getCurrentProfileId();

        await database.db.insert(postReactions).values({
          postId,
          profileId,
          reactionType,
        });

        return { success: true };
      } catch (error) {
        // Handle unique constraint violation (duplicate reaction)
        if (
          error instanceof Error &&
          error.message.includes('unique constraint')
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'You have already reacted to this post with this reaction type',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add reaction',
        });
      }
    }),

  removeReaction: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withDB)
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { database } = ctx;

      const profileId = await getCurrentProfileId();
      await database.db
        .delete(postReactions)
        .where(
          and(
            eq(postReactions.postId, postId),
            eq(postReactions.profileId, profileId),
            eq(postReactions.reactionType, reactionType),
          ),
        );

      return { success: true };
    }),

  toggleReaction: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 20 }))
    .use(withAuthenticated)
    .use(withDB)
    .input(
      z.object({
        postId: z.string(),
        reactionType: reactionTypeEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, reactionType } = input;
      const { database } = ctx;

      const profileId = await getCurrentProfileId();

      // Check if reaction exists
      const existingReaction = await database.db
        .select()
        .from(postReactions)
        .where(
          and(
            eq(postReactions.postId, postId),
            eq(postReactions.profileId, profileId),
            eq(postReactions.reactionType, reactionType),
          ),
        )
        .limit(1);

      if (existingReaction.length > 0) {
        // Remove existing reaction
        await database.db
          .delete(postReactions)
          .where(
            and(
              eq(postReactions.postId, postId),
              eq(postReactions.profileId, profileId),
              eq(postReactions.reactionType, reactionType),
            ),
          );

        return { success: true, action: 'removed' };
      } else {
        // Add new reaction
        await database.db.insert(postReactions).values({
          postId,
          profileId,
          reactionType,
        });

        return { success: true, action: 'added' };
      }
    }),
});

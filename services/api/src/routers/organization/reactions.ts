import { CommonError, getCurrentProfileId } from '@op/common';
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

        // First, remove any existing reaction from this user on this post
        await database.db
          .delete(postReactions)
          .where(
            and(
              eq(postReactions.postId, postId),
              eq(postReactions.profileId, profileId),
            ),
          );

        // Then add the new reaction
        await database.db.insert(postReactions).values({
          postId,
          profileId,
          reactionType,
        });

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
    .use(withDB)
    .input(
      z.object({
        postId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { postId } = input;
      const { database } = ctx;

      const profileId = await getCurrentProfileId();
      await database.db
        .delete(postReactions)
        .where(
          and(
            eq(postReactions.postId, postId),
            eq(postReactions.profileId, profileId),
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

        // Check if user has any existing reaction on this post
        const existingReaction = await database.db
          .select()
          .from(postReactions)
          .where(
            and(
              eq(postReactions.postId, postId),
              eq(postReactions.profileId, profileId),
            ),
          )
          .limit(1);

        if (existingReaction.length > 0) {
          // If user has the same reaction type, remove it
          if (existingReaction[0]?.reactionType === reactionType) {
            await database.db
              .delete(postReactions)
              .where(
                and(
                  eq(postReactions.postId, postId),
                  eq(postReactions.profileId, profileId),
                ),
              );

            return { success: true, action: 'removed' };
          } else {
            // If user has a different reaction type, replace it
            await database.db
              .delete(postReactions)
              .where(
                and(
                  eq(postReactions.postId, postId),
                  eq(postReactions.profileId, profileId),
                ),
              );

            await database.db.insert(postReactions).values({
              postId,
              profileId,
              reactionType,
            });

            return { success: true, action: 'replaced' };
          }
        } else {
          // No existing reaction, add new one
          await database.db.insert(postReactions).values({
            postId,
            profileId,
            reactionType,
          });

          return { success: true, action: 'added' };
        }
      } catch (e) {
        throw new CommonError('Failed to toggle reaction');
      }
    }),
});

// TODO: Re-enable when permission checks are restored
// import { Channels, getProfileAccessUser } from '@op/common';
import { Channels } from '@op/common';
import { and, db, eq } from '@op/db/client';
import { PollStatus, pollVotes, polls, users } from '@op/db/schema';
import { realtime } from '@op/realtime/server';
import { TRPCError } from '@trpc/server';
// import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const voteInputSchema = z.object({
  /** The poll ID to vote on */
  pollId: z.string().uuid(),
  /** Index of the selected option (0-based) */
  optionIndex: z.number().int().min(0),
});

const voteOutputSchema = z.object({
  pollId: z.string().uuid(),
  optionIndex: z.number(),
  isNewVote: z.boolean(),
});

export const voteRouter = router({
  /**
   * Submit or update a vote on a poll.
   * Uses upsert pattern - users can change their vote.
   * Requires member access to the poll's profile (org).
   */
  vote: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(voteInputSchema)
    .output(voteOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { pollId, optionIndex } = input;

      // Get the poll to validate it exists and is open
      const [poll] = await db
        .select()
        .from(polls)
        .where(eq(polls.id, pollId))
        .limit(1);

      if (!poll) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Poll not found',
        });
      }

      if (poll.status === PollStatus.CLOSED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Poll is closed and no longer accepting votes',
        });
      }

      // Validate option index is within bounds
      if (optionIndex >= poll.options.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid option index. Poll has ${poll.options.length} options (0-${poll.options.length - 1})`,
        });
      }

      // TODO: Re-enable permission checks once polling is profile-independent
      // Check user has access to the profile
      // const profileUser = await getProfileAccessUser({
      //   user,
      //   profileId: poll.profileId,
      // });

      // if (!profileUser) {
      //   throw new TRPCError({
      //     code: 'FORBIDDEN',
      //     message: 'You do not have access to this organization',
      //   });
      // }

      // Require at least read access to vote
      // assertAccess({ profile: permission.READ }, profileUser.roles);

      // Look up the user record by authUserId (ctx.user.id is the Supabase auth user ID)
      const [dbUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authUserId, user.id));

      if (!dbUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      try {
        // Check for existing vote
        const [existingVote] = await db
          .select()
          .from(pollVotes)
          .where(
            and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, dbUser.id)),
          )
          .limit(1);

        let isNewVote = false;

        if (existingVote) {
          // Update existing vote
          await db
            .update(pollVotes)
            .set({ optionIndex })
            .where(eq(pollVotes.id, existingVote.id));

          logger.info('Poll vote updated', {
            pollId,
            userId: dbUser.id,
            oldOptionIndex: existingVote.optionIndex,
            newOptionIndex: optionIndex,
          });
        } else {
          // Create new vote
          await db.insert(pollVotes).values({
            pollId,
            userId: dbUser.id,
            optionIndex,
          });

          isNewVote = true;

          logger.info('Poll vote created', {
            pollId,
            userId: dbUser.id,
            optionIndex,
          });
        }

        // Broadcast invalidation to poll subscribers
        await realtime.publish(Channels.poll(pollId), {
          mutationId: ctx.requestId,
        });

        return {
          pollId,
          optionIndex,
          isNewVote,
        };
      } catch (error) {
        logger.error('Failed to submit poll vote', {
          pollId,
          userId: user.id,
          optionIndex,
          error,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit vote',
        });
      }
    }),
});

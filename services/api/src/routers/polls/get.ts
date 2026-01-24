// TODO: Re-enable when permission checks are restored
// import { getProfileAccessUser } from '@op/common';
import { count, db, eq, sql } from '@op/db/client';
import { pollVotes, polls } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
// import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const getPollInputSchema = z.object({
  /** The poll ID to retrieve */
  pollId: z.string().uuid(),
});

const pollOptionWithCountSchema = z.object({
  text: z.string(),
  voteCount: z.number(),
});

const getPollOutputSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdById: z.string().uuid(),
  question: z.string(),
  options: z.array(pollOptionWithCountSchema),
  status: z.enum(['open', 'closed']),
  targetType: z.string(),
  targetId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  totalVotes: z.number(),
  /** Current user's vote option index, null if not voted */
  userVote: z.number().nullable(),
});

export const getRouter = router({
  /**
   * Get a poll by ID with vote counts per option.
   * Includes the current user's vote if they have voted.
   * Requires read access to the poll's profile (org).
   */
  get: commonAuthedProcedure()
    .input(getPollInputSchema)
    .output(getPollOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { pollId } = input;

      // Get the poll
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

      // assertAccess({ profile: permission.READ }, profileUser.roles);

      try {
        // Get vote counts grouped by option index
        const voteCounts = await db
          .select({
            optionIndex: pollVotes.optionIndex,
            count: count(),
          })
          .from(pollVotes)
          .where(eq(pollVotes.pollId, pollId))
          .groupBy(pollVotes.optionIndex);

        // Create a map of option index to count
        const voteCountMap = new Map<number, number>();
        let totalVotes = 0;
        for (const vc of voteCounts) {
          voteCountMap.set(vc.optionIndex, vc.count);
          totalVotes += vc.count;
        }

        // Get current user's vote
        const [userVoteRecord] = await db
          .select({ optionIndex: pollVotes.optionIndex })
          .from(pollVotes)
          .where(
            sql`${pollVotes.pollId} = ${pollId} AND ${pollVotes.userId} = ${user.id}`,
          )
          .limit(1);

        // Transform options with vote counts
        const optionsWithCounts = poll.options.map((option, index) => ({
          text: option.text,
          voteCount: voteCountMap.get(index) ?? 0,
        }));

        logger.info('Poll retrieved', {
          pollId,
          userId: user.id,
          totalVotes,
        });

        return getPollOutputSchema.parse({
          ...poll,
          options: optionsWithCounts,
          totalVotes,
          userVote: userVoteRecord?.optionIndex ?? null,
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Failed to get poll', {
          pollId,
          userId: user.id,
          error,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get poll',
        });
      }
    }),
});

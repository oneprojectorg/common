// TODO: Re-enable when permission checks are restored
// import { getProfileAccessUser } from '@op/common';
import { db, eq, sql } from '@op/db/client';
import { objectsInStorage, pollVotes, polls, users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
// import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const getPollInputSchema = z.object({
  /** The poll ID to retrieve */
  pollId: z.string().uuid(),
});

const voterSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string(),
  avatarImageName: z.string().nullable(),
});

const pollOptionWithCountSchema = z.object({
  text: z.string(),
  voteCount: z.number(),
  voters: z.array(voterSchema),
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
        // Get all votes with voter info
        const votes = await db
          .select({
            optionIndex: pollVotes.optionIndex,
            userId: pollVotes.userId,
            userName: users.name,
            avatarImageName: objectsInStorage.name,
          })
          .from(pollVotes)
          .innerJoin(users, eq(pollVotes.userId, users.id))
          .leftJoin(
            objectsInStorage,
            eq(users.avatarImageId, objectsInStorage.id),
          )
          .where(eq(pollVotes.pollId, pollId));

        // Build vote counts and voters per option
        const voteCountMap = new Map<number, number>();
        const votersMap = new Map<
          number,
          Array<{
            userId: string;
            name: string | null;
            avatarImageName: string | null;
          }>
        >();
        let totalVotes = 0;

        for (const vote of votes) {
          // Increment count
          voteCountMap.set(
            vote.optionIndex,
            (voteCountMap.get(vote.optionIndex) ?? 0) + 1,
          );
          totalVotes += 1;

          // Add voter
          const voters = votersMap.get(vote.optionIndex) ?? [];
          voters.push({
            userId: vote.userId,
            name: vote.userName,
            avatarImageName: vote.avatarImageName,
          });
          votersMap.set(vote.optionIndex, voters);
        }

        // Get current user's vote
        const [userVoteRecord] = await db
          .select({ optionIndex: pollVotes.optionIndex })
          .from(pollVotes)
          .where(
            sql`${pollVotes.pollId} = ${pollId} AND ${pollVotes.userId} = ${user.id}`,
          )
          .limit(1);

        // Transform options with vote counts and voters
        const optionsWithCounts = poll.options.map((option, index) => ({
          text: option.text,
          voteCount: voteCountMap.get(index) ?? 0,
          voters: votersMap.get(index) ?? [],
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

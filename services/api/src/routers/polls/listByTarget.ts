import { Channels } from '@op/common';
import { and, db, desc, eq, inArray } from '@op/db/client';
import { objectsInStorage, pollVotes, polls, users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const listByTargetInputSchema = z.object({
  /** Type of entity (e.g. 'proposal', 'process', 'meeting') */
  targetType: z.string().min(1).max(100),
  /** ID of the entity */
  targetId: z.string().uuid(),
});

const voterSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().nullable(),
  avatarImageName: z.string().nullable(),
});

const pollOptionWithCountSchema = z.object({
  text: z.string(),
  voteCount: z.number(),
  voters: z.array(voterSchema),
});

const pollSummarySchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  options: z.array(pollOptionWithCountSchema),
  status: z.enum(['open', 'closed']),
  createdById: z.string().uuid(),
  createdAt: z.coerce.date(),
  totalVotes: z.number(),
  /** Current user's vote option index, null if not voted */
  userVote: z.number().nullable(),
});

const listByTargetOutputSchema = z.object({
  polls: z.array(pollSummarySchema),
});

export const listByTargetRouter = router({
  /**
   * List all polls attached to a specific entity.
   * Returns polls with vote counts per option.
   */
  listByTarget: commonAuthedProcedure()
    .input(listByTargetInputSchema)
    .output(listByTargetOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { targetType, targetId } = input;

      try {
        // Get all polls for this target
        const targetPolls = await db
          .select()
          .from(polls)
          .where(
            and(eq(polls.targetType, targetType), eq(polls.targetId, targetId)),
          )
          .orderBy(desc(polls.createdAt));

        if (targetPolls.length === 0) {
          return { polls: [] };
        }

        // Get all votes with voter info for all polls in one query
        const pollIds = targetPolls.map((p) => p.id);
        const votes = await db
          .select({
            pollId: pollVotes.pollId,
            optionIndex: pollVotes.optionIndex,
            oduserId: pollVotes.userId,
            userName: users.name,
            avatarImageName: objectsInStorage.name,
          })
          .from(pollVotes)
          .innerJoin(users, eq(pollVotes.userId, users.id))
          .leftJoin(
            objectsInStorage,
            eq(users.avatarImageId, objectsInStorage.id),
          )
          .where(inArray(pollVotes.pollId, pollIds));

        // Look up the user record by authUserId (ctx.user.id is the Supabase auth user ID)
        const [dbUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.authUserId, user.id));

        // Build maps for vote counts, voters, and user votes
        type Voter = {
          userId: string;
          name: string | null;
          avatarImageName: string | null;
        };
        const voteCountMap = new Map<string, Map<number, number>>();
        const votersMap = new Map<string, Map<number, Voter[]>>();
        const userVoteMap = new Map<string, number>();

        for (const vote of votes) {
          // Initialize poll maps if needed
          if (!voteCountMap.has(vote.pollId)) {
            voteCountMap.set(vote.pollId, new Map());
            votersMap.set(vote.pollId, new Map());
          }

          const pollCounts = voteCountMap.get(vote.pollId);
          const pollVoters = votersMap.get(vote.pollId);

          if (!pollCounts || !pollVoters) {
            continue;
          }

          // Increment count
          pollCounts.set(
            vote.optionIndex,
            (pollCounts.get(vote.optionIndex) ?? 0) + 1,
          );

          // Add voter
          const voters = pollVoters.get(vote.optionIndex) ?? [];
          voters.push({
            userId: vote.oduserId,
            name: vote.userName,
            avatarImageName: vote.avatarImageName,
          });
          pollVoters.set(vote.optionIndex, voters);

          // Track current user's vote
          if (dbUser && vote.oduserId === dbUser.id) {
            userVoteMap.set(vote.pollId, vote.optionIndex);
          }
        }

        // Transform polls with counts and voters
        const pollsWithCounts = targetPolls.map((poll) => {
          const pollVoteCounts = voteCountMap.get(poll.id) ?? new Map();
          const pollVoters = votersMap.get(poll.id) ?? new Map();
          let totalVotes = 0;

          const optionsWithCounts = poll.options.map((option, index) => {
            const voteCount = pollVoteCounts.get(index) ?? 0;
            totalVotes += voteCount;
            return {
              text: option.text,
              voteCount,
              voters: pollVoters.get(index) ?? [],
            };
          });

          return pollSummarySchema.parse({
            id: poll.id,
            question: poll.question,
            options: optionsWithCounts,
            status: poll.status,
            createdById: poll.createdById,
            createdAt: poll.createdAt,
            totalVotes,
            userVote: userVoteMap.get(poll.id) ?? null,
          });
        });

        logger.info('Polls listed by target', {
          targetType,
          targetId,
          userId: user.id,
          count: pollsWithCounts.length,
        });

        // Register realtime channel for proposal polls
        if (targetType === 'proposal') {
          ctx.registerQueryChannels([Channels.proposalPolls(targetId)]);
        }

        return { polls: pollsWithCounts };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Failed to list polls by target', {
          targetType,
          targetId,
          userId: user.id,
          error,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list polls',
        });
      }
    }),
});

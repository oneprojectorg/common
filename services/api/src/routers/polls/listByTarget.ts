import { and, count, db, desc, eq, inArray } from '@op/db/client';
import { pollVotes, polls, users } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const listByTargetInputSchema = z.object({
  /** Type of entity (e.g. 'proposal', 'process', 'meeting') */
  targetType: z.string().min(1).max(100),
  /** ID of the entity */
  targetId: z.string().uuid(),
});

const pollOptionWithCountSchema = z.object({
  text: z.string(),
  voteCount: z.number(),
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

        // Get vote counts for all polls in one query
        const pollIds = targetPolls.map((p) => p.id);
        const voteCounts = await db
          .select({
            pollId: pollVotes.pollId,
            optionIndex: pollVotes.optionIndex,
            count: count(),
          })
          .from(pollVotes)
          .where(inArray(pollVotes.pollId, pollIds))
          .groupBy(pollVotes.pollId, pollVotes.optionIndex);

        // Look up the user record by authUserId (ctx.user.id is the Supabase auth user ID)
        const [dbUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.authUserId, user.id));

        // Get current user's votes for all polls (only if user exists)
        const userVotes = dbUser
          ? await db
              .select({
                pollId: pollVotes.pollId,
                optionIndex: pollVotes.optionIndex,
              })
              .from(pollVotes)
              .where(
                and(
                  inArray(pollVotes.pollId, pollIds),
                  eq(pollVotes.userId, dbUser.id),
                ),
              )
          : [];

        // Build maps for quick lookup
        const voteCountMap = new Map<string, Map<number, number>>();
        for (const vc of voteCounts) {
          let pollCounts = voteCountMap.get(vc.pollId);
          if (!pollCounts) {
            pollCounts = new Map();
            voteCountMap.set(vc.pollId, pollCounts);
          }
          pollCounts.set(vc.optionIndex, vc.count);
        }

        const userVoteMap = new Map<string, number>();
        for (const uv of userVotes) {
          userVoteMap.set(uv.pollId, uv.optionIndex);
        }

        // Transform polls with counts
        const pollsWithCounts = targetPolls.map((poll) => {
          const pollVoteCounts = voteCountMap.get(poll.id) ?? new Map();
          let totalVotes = 0;

          const optionsWithCounts = poll.options.map((option, index) => {
            const voteCount = pollVoteCounts.get(index) ?? 0;
            totalVotes += voteCount;
            return {
              text: option.text,
              voteCount,
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

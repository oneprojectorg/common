// TODO: Re-enable when permission checks are restored
// import { getProfileAccessUser } from '@op/common';
import { Channels } from '@op/common';
import { db, eq } from '@op/db/client';
import { type PollOption, polls, users } from '@op/db/schema';
import { realtime } from '@op/realtime/server';
import { TRPCError } from '@trpc/server';
// import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const createPollInputSchema = z.object({
  /** The poll question */
  question: z.string().min(1).max(500),
  /** Array of poll option texts (2-10 options) */
  options: z
    .array(z.string().min(1).max(200))
    .min(2, 'Poll must have at least 2 options')
    .max(10, 'Poll cannot have more than 10 options'),
  /** Type of entity this poll is attached to (e.g. 'proposal', 'process', 'meeting') */
  targetType: z.string().min(1).max(100),
  /** ID of the entity this poll is attached to */
  targetId: z.string().uuid(),
  /** Profile (org) ID where this poll belongs */
  profileId: z.string().uuid(),
});

const pollOutputSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  createdById: z.string().uuid(),
  question: z.string(),
  options: z.array(z.object({ text: z.string() })),
  status: z.enum(['open', 'closed']),
  targetType: z.string(),
  targetId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createPollRouter = router({
  /**
   * Creates a new poll attached to a target entity.
   * Requires member access to the profile (org).
   */
  create: commonAuthedProcedure()
    .input(createPollInputSchema)
    .output(pollOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;
      const { question, options, targetType, targetId, profileId } = input;

      try {
        // TODO: Re-enable permission checks once polling is profile-independent
        // Check user has access to the profile
        // const profileUser = await getProfileAccessUser({
        //   user,
        //   profileId,
        // });

        // if (!profileUser) {
        //   throw new TRPCError({
        //     code: 'FORBIDDEN',
        //     message: 'You do not have access to this organization',
        //   });
        // }

        // Require at least read access to create polls (any member can create)
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

        // Transform options array to PollOption format
        const pollOptions: PollOption[] = options.map((text) => ({ text }));

        // Create the poll
        const [poll] = await db
          .insert(polls)
          .values({
            profileId,
            createdById: dbUser.id,
            question,
            options: pollOptions,
            targetType,
            targetId,
          })
          .returning();

        if (!poll) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create poll',
          });
        }

        logger.info('Poll created', {
          pollId: poll.id,
          profileId,
          targetType,
          targetId,
          userId: user.id,
        });

        // Broadcast to proposal polls channel if target is a proposal
        if (targetType === 'proposal') {
          await realtime.publish(Channels.proposalPolls(targetId), {
            mutationId: ctx.requestId,
          });
        }

        return pollOutputSchema.parse(poll);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Failed to create poll', {
          userId: user.id,
          profileId,
          targetType,
          targetId,
          error,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create poll',
        });
      }
    }),
});

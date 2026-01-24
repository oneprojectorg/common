import { getProfileAccessUser } from '@op/common';
import { db, eq } from '@op/db/client';
import { PollStatus, polls } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { type NormalizedRole, assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const closeInputSchema = z.object({
  /** The poll ID to close */
  pollId: z.string().uuid(),
});

const closeOutputSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'closed']),
  closedAt: z.coerce.date(),
});

/**
 * Check if user has admin access to the profile.
 * Returns true if they do, false otherwise (doesn't throw).
 */
function checkAdminAccess(roles: NormalizedRole[]): boolean {
  try {
    assertAccess({ profile: permission.ADMIN }, roles);
    return true;
  } catch {
    return false;
  }
}

export const closeRouter = router({
  /**
   * Close a poll, preventing further votes.
   * Only the poll creator or org admins can close a poll.
   */
  close: commonAuthedProcedure()
    .input(closeInputSchema)
    .output(closeOutputSchema)
    .mutation(async ({ ctx, input }) => {
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

      if (poll.status === PollStatus.CLOSED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Poll is already closed',
        });
      }

      // Check user has access to the profile
      const profileUser = await getProfileAccessUser({
        user,
        profileId: poll.profileId,
      });

      if (!profileUser) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization',
        });
      }

      // User must be the poll creator OR have admin access to the org
      const isCreator = poll.createdById === user.id;
      const isAdmin = checkAdminAccess(profileUser.roles);

      if (!isCreator && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'Only the poll creator or organization admins can close a poll',
        });
      }

      try {
        const [updatedPoll] = await db
          .update(polls)
          .set({ status: PollStatus.CLOSED })
          .where(eq(polls.id, pollId))
          .returning({
            id: polls.id,
            status: polls.status,
            updatedAt: polls.updatedAt,
          });

        if (!updatedPoll) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to close poll',
          });
        }

        logger.info('Poll closed', {
          pollId,
          userId: user.id,
          isCreator,
          isAdmin,
        });

        return closeOutputSchema.parse({
          id: updatedPoll.id,
          status: updatedPoll.status,
          closedAt: updatedPoll.updatedAt,
        });
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Failed to close poll', {
          pollId,
          userId: user.id,
          error,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to close poll',
        });
      }
    }),
});

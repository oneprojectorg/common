import { invalidateMultiple } from '@op/cache';
import { CommonError, inviteUsersToProfile } from '@op/common';
import { db } from '@op/db/client';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  emails: z
    .array(z.email('Must be a valid email address'))
    .min(1, 'At least one email address is required'),
  roleId: z.string().uuid(),
  profileId: z.string().uuid(),
  personalMessage: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  details: z.object({
    successful: z.array(z.string()),
    failed: z.array(
      z.object({
        email: z.string(),
        reason: z.string(),
      }),
    ),
  }),
});

export const inviteProfileUserRouter = router({
  invite: commonProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { user } = ctx;

        const result = await inviteUsersToProfile({
          emails: input.emails,
          roleId: input.roleId,
          requesterProfileId: input.profileId,
          personalMessage: input.personalMessage,
          user,
        });

        // Invalidate caches for users who were successfully invited
        if (result.details.successful.length > 0) {
          // Find existing users by email to get their auth user IDs
          const existingUsers = await db.query.users.findMany({
            where: (table, { inArray }) =>
              inArray(table.email, result.details.successful),
            columns: { authUserId: true },
          });

          if (existingUsers.length > 0) {
            const userIds = existingUsers.map((u) => u.authUserId);
            waitUntil(
              invalidateMultiple({
                type: 'user',
                paramsList: userIds.map((id) => [id]),
              }),
            );
          }
        }

        return result;
      } catch (error) {
        if (error instanceof CommonError) {
          throw error;
        }

        // Handle other errors
        const message =
          error instanceof Error ? error.message : 'Failed to send invitation';

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});

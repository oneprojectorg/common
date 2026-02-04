import { invalidateMultiple } from '@op/cache';
import { inviteUsersToProfile } from '@op/common';
import { db } from '@op/db/client';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

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
  invite: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 10 },
  })
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
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
          where: { email: { in: result.details.successful } },
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
    }),
});

import { invalidateMultiple } from '@op/cache';
import { inviteUsersToProfile } from '@op/common';
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
    existingUserAuthIds: z.array(z.string()),
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

      // Invalidate caches for existing users who were successfully invited
      if (result.details.existingUserAuthIds.length > 0) {
        waitUntil(
          invalidateMultiple({
            type: 'user',
            paramsList: result.details.existingUserAuthIds.map((id) => [id]),
          }),
        );
      }

      return result;
    }),
});

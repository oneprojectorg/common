import { invalidateMultiple } from '@op/cache';
import { getIndividualProfileId, inviteUsersToProfile } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: z.email('Must be a valid email address'),
        roleId: z.string().uuid(),
      }),
    )
    .min(1, 'At least one invitation is required'),
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
      const requesterProfileId = await getIndividualProfileId(user.id);

      const result = await inviteUsersToProfile({
        invitations: input.invitations,
        profileId: input.profileId,
        requesterProfileId,
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

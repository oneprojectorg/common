import { invalidate } from '@op/cache';
import {
  assertOrganization,
  assertUserByAuthId,
  joinOrganization as joinOrganizationService,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.uuid('Organization ID must be a valid UUID'),
});

export const joinOrganization = router({
  join: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 5 },
  })
    .input(inputSchema)
    .output(
      z.object({
        organizationUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [organization, user] = await Promise.all([
          assertOrganization(input.organizationId),
          assertUserByAuthId(ctx.user.id),
        ]);

        const result = await joinOrganizationService({
          user,
          organization,
        });

        // Invalidate user cache since organization membership has changed. This should be awaited since we want to kill cache BEFORE returning
        await invalidate({
          type: 'user',
          params: [ctx.user.id],
        });

        return {
          organizationUserId: result?.id || '',
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to join organization';

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),
});

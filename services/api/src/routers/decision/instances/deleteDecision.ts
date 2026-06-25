import { invalidateMultiple } from '@op/cache';
import { Channels, deleteDecision } from '@op/common';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../../trpcFactory';

export const deleteDecisionRouter = router({
  deleteDecision: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        instanceId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await deleteDecision({
        instanceId: input.instanceId,
        user: ctx.user,
      });

      // Drop the writer's own cached projections; other viewers' per-caller
      // entries TTL out.
      waitUntil(
        invalidateMultiple({
          type: 'decision',
          paramsList: [
            [input.instanceId, ctx.user.id, 'instance'],
            [input.instanceId, ctx.user.id, 'categories'],
          ],
        }),
      );

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);
    }),
});

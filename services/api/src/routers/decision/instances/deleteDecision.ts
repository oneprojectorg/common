import {
  Channels,
  deleteDecision,
  invalidateDecisionInstance,
} from '@op/common';
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

      waitUntil(invalidateDecisionInstance(input.instanceId));

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);
    }),
});

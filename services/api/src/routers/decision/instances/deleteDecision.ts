import { Channels, deleteDecision } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const deleteDecisionRouter = router({
  deleteDecision: networkAuthenticatedProcedure({
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

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);
    }),
});

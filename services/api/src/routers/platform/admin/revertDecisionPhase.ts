import { Channels, invalidateDecisionInstance, revertPhase } from '@op/common';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

export const revertDecisionPhaseRouter = router({
  revertDecisionPhase: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        instanceId: z.uuid(),
        fromPhaseId: z.string().min(1).optional(),
      }),
    )
    .output(
      z.object({
        currentPhaseId: z.string(),
        revertedPhaseId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await revertPhase({
        instanceId: input.instanceId,
        fromPhaseId: input.fromPhaseId,
      });

      // Awaited, not deferred: the admin screen refetches the instance as soon
      // as this mutation lands, and a stale snapshot would show the phase it
      // just moved away from.
      await invalidateDecisionInstance(input.instanceId);

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return result;
    }),
});

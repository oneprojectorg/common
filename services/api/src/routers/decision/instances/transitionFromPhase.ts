import { Channels, triggerPhaseAdvancement } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const transitionFromPhaseRouter = router({
  transitionFromPhase: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        fromPhaseId: z.string().min(1).optional(),
      }),
    )
    .output(
      z.object({
        currentPhaseId: z.string(),
        previousPhaseId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await triggerPhaseAdvancement({
        instanceId: input.instanceId,
        fromPhaseId: input.fromPhaseId,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return result;
    }),
});

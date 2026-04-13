import { Channels, manualTransition } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const manualTransitionRouter = router({
  manualTransition: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        fromPhaseId: z.string().min(1).optional(),
      }),
    )
    .output(
      z.object({
        instanceId: z.string(),
        currentPhaseId: z.string(),
        previousPhaseId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await manualTransition({
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

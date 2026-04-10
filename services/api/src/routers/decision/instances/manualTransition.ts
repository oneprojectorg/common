import { manualTransition } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const manualTransitionRouter = router({
  manualTransition: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
        fromPhaseId: z.string().optional(),
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
      return manualTransition({
        instanceId: input.instanceId,
        fromPhaseId: input.fromPhaseId,
        user: ctx.user,
      });
    }),
});

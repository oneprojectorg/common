import { previewPhaseTransition } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const previewPhaseTransitionRouter = router({
  previewPhaseTransition: commonAuthedProcedure()
    .input(
      z.object({
        instanceId: z.uuid(),
      }),
    )
    .output(
      z.object({
        selectedProposalIds: z.array(z.string()),
        fromPhaseId: z.string(),
        toPhaseId: z.string(),
        fromPhaseName: z.string(),
        toPhaseName: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return previewPhaseTransition({
        instanceId: input.instanceId,
        user: ctx.user,
      });
    }),
});

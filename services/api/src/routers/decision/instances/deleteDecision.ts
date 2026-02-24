import { deleteDecision } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const deleteDecisionRouter = router({
  deleteDecision: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        instanceId: z.uuid(),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        deletedId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await deleteDecision({
        instanceId: input.instanceId,
        user: ctx.user,
      });
    }),
});

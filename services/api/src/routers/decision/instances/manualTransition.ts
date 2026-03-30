import { manualTransition } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const manualTransitionRouter = router({
  manualTransition: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(
      z.object({
        instanceId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await manualTransition({
        instanceId: input.instanceId,
        user: ctx.user,
      });

      return result;
    }),
});

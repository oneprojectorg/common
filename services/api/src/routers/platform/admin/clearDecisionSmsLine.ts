import { Channels, clearDecisionSmsLine } from '@op/common';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const clearDecisionSmsLineRouter = router({
  clearDecisionSmsLine: networkAuthenticatedProcedure()
    .use(withAuthenticatedPlatformAdmin)
    .input(z.object({ instanceId: z.uuid() }))
    .output(z.object({ cleared: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await clearDecisionSmsLine({
        instanceId: input.instanceId,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return result;
    }),
});

import { Channels, setDecisionChatLine } from '@op/common';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const setDecisionChatLineRouter = router({
  setDecisionChatLine: networkAuthenticatedProcedure()
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        instanceId: z.uuid(),
        phoneNumber: z.string().trim().min(1).max(32),
      }),
    )
    .output(z.object({ phoneNumber: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await setDecisionChatLine({
        instanceId: input.instanceId,
        phoneNumber: input.phoneNumber,
      });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return result;
    }),
});

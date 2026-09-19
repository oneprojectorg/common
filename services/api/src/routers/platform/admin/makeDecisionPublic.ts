import { Channels, makeDecisionPublic } from '@op/common';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const makeDecisionPublicRouter = router({
  // The network gate rejects everyone else before the admin allow list runs.
  makeDecisionPublic: networkAuthenticatedProcedure()
    .use(withAuthenticatedPlatformAdmin)
    .input(z.object({ instanceId: z.uuid() }))
    .output(z.object({ profileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await makeDecisionPublic({ instanceId: input.instanceId });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return result;
    }),
});

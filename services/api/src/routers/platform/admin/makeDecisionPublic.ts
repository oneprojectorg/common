import { Channels, makeDecisionPublic } from '@op/common';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const makeDecisionPublicRouter = router({
  // Platform admins are all in-network, so the network gate rejects everyone
  // else with an AccessTierError before the admin allow-list is consulted.
  makeDecisionPublic: networkAuthenticatedProcedure()
    .use(withAuthenticatedPlatformAdmin)
    .input(z.object({ instanceId: z.uuid() }))
    .output(
      z.object({
        profileId: z.string(),
        isPublic: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // The service invalidates the access and instance caches itself, so the
      // admin screen's refetch already sees the decision as public.
      const result = await makeDecisionPublic({ instanceId: input.instanceId });

      ctx.registerMutationChannels([
        Channels.decisionInstance(input.instanceId),
      ]);

      return result;
    }),
});

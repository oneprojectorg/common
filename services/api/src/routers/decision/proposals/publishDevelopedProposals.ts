import {
  Channels,
  invalidateDecisionInstance,
  publishDevelopedProposals,
} from '@op/common';
import {
  instanceRefSchema,
  publishDevelopedProposalsResultSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const publishDevelopedProposalsRouter = router({
  publishDevelopedProposals: networkAuthenticatedProcedure()
    .input(instanceRefSchema)
    .output(publishDevelopedProposalsResultSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await publishDevelopedProposals({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });

      // Awaited: `getInstance` refetches on `decisionInstance` and must not
      // read a stale cached snapshot.
      await invalidateDecisionInstance(input.processInstanceId);

      // Publish confirms the phase's selections (instance), makes entries
      // visible (proposal lists) and closes the develop window (category
      // develop status).
      ctx.registerMutationChannels([
        Channels.decisionInstance(input.processInstanceId),
        Channels.decisionProposals(input.processInstanceId),
        Channels.decisionDevelopLock(input.processInstanceId),
      ]);

      return result;
    }),
});

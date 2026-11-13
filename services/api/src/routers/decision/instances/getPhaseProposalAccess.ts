import {
  Channels,
  getPhaseProposalAccess,
  phaseProposalAccessInputSchema,
  phaseProposalAccessSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getPhaseProposalAccessRouter = router({
  getPhaseProposalAccess: networkAuthenticatedProcedure()
    .input(phaseProposalAccessInputSchema)
    .output(phaseProposalAccessSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionInstance(input.processInstanceId),
      ]);

      return await getPhaseProposalAccess({
        ...input,
        user: ctx.user,
      });
    }),
});

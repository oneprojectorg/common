import {
  Channels,
  notifyProposalCorpusChanged,
  unrejectProposal,
} from '@op/common';
import { unrejectProposalInputSchema } from '@op/common/client';
import { waitUntil } from '@vercel/functions';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const unrejectProposalRouter = router({
  /**
   * Undo a rejection: move the proposal back to `SUBMITTED` so it re-enters
   * every list, phase, and vote. Closed-network + `decisions: ADMIN`, the same
   * gating as `rejectProposal`.
   */
  unrejectProposal: networkAuthenticatedProcedure()
    .input(unrejectProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, proposalId } = await unrejectProposal({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // It rejoins every list and the ballot.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);

      // It rejoins the corpus the theme analysis reads.
      waitUntil(notifyProposalCorpusChanged({ processInstanceId }));
    }),
});

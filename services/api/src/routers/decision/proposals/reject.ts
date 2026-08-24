import { Channels, rejectProposal } from '@op/common';
import { rejectProposalInputSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const rejectProposalRouter = router({
  /**
   * Move a proposal to `REJECTED`. Closed-network + `decisions: ADMIN`.
   *
   * The status change drops the proposal from every read (phases, review,
   * voting, the default list) — it only stays visible to admins on the proposal
   * list, like a flagged proposal.
   */
  rejectProposal: networkAuthenticatedProcedure()
    .input(rejectProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, proposalId } = await rejectProposal({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // The status change moves it out of every list and off the ballot.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);
    }),
});

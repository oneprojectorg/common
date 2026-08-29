import { Channels, rejectProposal } from '@op/common';
import { rejectProposalInputSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const rejectProposalRouter = router({
  /**
   * Move a proposal to `REJECTED`. Closed-network + `decisions: ADMIN`.
   *
   * The status change stops the proposal advancing through phases, being
   * reviewed, and being votable; it stays listed and readable, badged with its
   * status.
   *
   * `reason` and `note` are collected and validated here but go nowhere yet —
   * the stacked follow-up carries them to the author's rejection email.
   */
  rejectProposal: networkAuthenticatedProcedure()
    .input(rejectProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, proposalId } = await rejectProposal({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // The status change moves it off the ballot and out of review.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);
    }),
});

import { Channels, rejectProposal } from '@op/common';
import { rejectProposalInputSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const rejectProposalRouter = router({
  /**
   * Move a proposal to `REJECTED`. Closed-network + `decisions: ADMIN`.
   *
   * The reason and optional author note are captured but not yet persisted
   * (ONE-931) — the durable effect today is the status change, which drops the
   * proposal from selection and re-badges it as "Not shortlisted".
   */
  rejectProposal: networkAuthenticatedProcedure()
    .input(rejectProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, proposalId } = await rejectProposal({
        proposalId: input.proposalId,
        reason: input.reason,
        note: input.note,
        user: ctx.user,
      });

      // The status change moves it out of every list and off the ballot.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, proposalId),
      ]);
    }),
});

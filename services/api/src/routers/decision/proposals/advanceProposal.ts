import { Channels, advanceProposal } from '@op/common';
import { advanceProposalInputSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const advanceProposalRouter = router({
  /**
   * Advance one proposal into the current phase, generating its review
   * assignments when that phase is a review phase. Closed-network +
   * `decisions: ADMIN`.
   */
  advanceProposal: networkAuthenticatedProcedure()
    .input(advanceProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId } = await advanceProposal({
        proposalId: input.proposalId,
        phaseId: input.phaseId,
        user: ctx.user,
      });

      // It joins the current phase's lists and, in a review phase, the
      // reviewers' queues.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, input.proposalId),
        Channels.reviewAssignments(processInstanceId),
      ]);
    }),
});

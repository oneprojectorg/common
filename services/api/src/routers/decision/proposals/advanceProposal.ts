import {
  Channels,
  advanceProposal,
  getProposalAdvanceTarget,
} from '@op/common';
import {
  advanceProposalInputSchema,
  getProposalAdvanceTargetInputSchema,
  proposalAdvanceTargetSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const advanceProposalRouter = router({
  /**
   * The current phase an admin can pull this proposal into, or `null` when it
   * is already there or the phase can't take it. Closed-network +
   * `decisions: ADMIN`.
   */
  getProposalAdvanceTarget: networkAuthenticatedProcedure()
    .input(getProposalAdvanceTargetInputSchema)
    .output(proposalAdvanceTargetSchema.nullable())
    .query(async ({ ctx, input }) => {
      const { processInstanceId, target } = await getProposalAdvanceTarget({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // A phase change, rejection or advance changes the answer.
      ctx.registerQueryChannels([
        Channels.decisionInstance(processInstanceId),
        Channels.decisionProposal(processInstanceId, input.proposalId),
      ]);

      return target;
    }),

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

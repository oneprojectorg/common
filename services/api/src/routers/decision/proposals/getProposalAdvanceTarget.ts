import { Channels, getProposalAdvanceTarget } from '@op/common';
import {
  getProposalAdvanceTargetInputSchema,
  proposalAdvanceTargetSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getProposalAdvanceTargetRouter = router({
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
});

import { Channels, mergeProposals } from '@op/common';
import { mergeProposalsInputSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const mergeProposalsRouter = router({
  /**
   * Link one proposal into another as `merged`: nothing is combined and no status
   * changes, but the source drops out of listings, selection, and review.
   * Closed-network + `decisions: ADMIN`. Distinct from `addProposalRelationship`
   * (proposal like/follow).
   */
  mergeProposals: networkAuthenticatedProcedure()
    .input(mergeProposalsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, sourceProposalId, targetProposalId } =
        await mergeProposals({
          sourceProposalId: input.sourceProposalId,
          targetProposalId: input.targetProposalId,
          user: ctx.user,
        });

      // The source leaves every list and the target gains a relationship.
      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, sourceProposalId),
        Channels.decisionProposal(processInstanceId, targetProposalId),
      ]);
    }),
});

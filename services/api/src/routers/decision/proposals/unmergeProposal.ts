import {
  Channels,
  notifyProposalCorpusChanged,
  unmergeProposal,
} from '@op/common';
import { unmergeProposalInputSchema } from '@op/common/client';
import { waitUntil } from '@vercel/functions';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const unmergeProposalRouter = router({
  /**
   * Undo a merge: drop the edge, putting the proposal back in every listing
   * with the status it had all along. Same gating as `mergeProposals`.
   */
  unmergeProposal: networkAuthenticatedProcedure()
    .input(unmergeProposalInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { processInstanceId, sourceProposalId, targetProposalId } =
        await unmergeProposal({
          sourceProposalId: input.sourceProposalId,
          user: ctx.user,
        });

      ctx.registerMutationChannels([
        Channels.decisionProposals(processInstanceId),
        Channels.decisionProposal(processInstanceId, sourceProposalId),
        // Absent when the proposal this one was merged into has been deleted.
        ...(targetProposalId
          ? [Channels.decisionProposal(processInstanceId, targetProposalId)]
          : []),
      ]);

      // The source rejoins the corpus the theme analysis reads.
      waitUntil(notifyProposalCorpusChanged({ processInstanceId }));
    }),
});

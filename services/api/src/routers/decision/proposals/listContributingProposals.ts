import { Channels, listContributingProposals } from '@op/common';
import {
  contributingProposalListSchema,
  listContributingProposalsInputSchema,
} from '@op/common/client';

import { openProcedure, router } from '../../../trpcFactory';

export const listContributingProposalsRouter = router({
  /**
   * `openProcedure` like `getProposal` — this renders alongside the proposal,
   * which public decision visitors can see. The service asserts `decisions: READ`.
   */
  listContributingProposals: openProcedure()
    .input(listContributingProposalsInputSchema)
    .output(contributingProposalListSchema)
    .query(async ({ ctx, input }) => {
      const { proposals, queriedProposal } = await listContributingProposals({
        proposalId: input.proposalId,
        user: ctx.user,
      });

      // Merge and unmerge register this channel for both ends of the edge.
      ctx.registerQueryChannels([
        Channels.decisionProposal(
          queriedProposal.processInstanceId,
          queriedProposal.id,
        ),
      ]);

      return contributingProposalListSchema.parse({ proposals });
    }),
});

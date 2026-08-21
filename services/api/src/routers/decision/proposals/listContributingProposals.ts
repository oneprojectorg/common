import { Channels, listContributingProposals } from '@op/common';
import {
  contributingProposalListSchema,
  listContributingProposalsInputSchema,
} from '@op/common/client';

import { openProcedure, router } from '../../../trpcFactory';

export const listContributingProposalsRouter = router({
  /**
   * The proposals merged into this one, as "Contributing ideas" cards.
   * `openProcedure` to match `getProposal`, since this renders alongside the
   * proposal and public decision visitors see both; the service asserts
   * `decisions: READ`.
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

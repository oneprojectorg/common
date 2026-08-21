import { Channels, listProposalRelationships } from '@op/common';
import {
  listProposalRelationshipsInputSchema,
  proposalRelationshipListSchema,
} from '@op/common/client';

import { openProcedure, router } from '../../../trpcFactory';

export const listProposalRelationshipsRouter = router({
  /**
   * A proposal's merge links. `openProcedure` to match `getProposal`, since this
   * renders alongside the proposal and public decision visitors see both; the
   * service asserts `decisions: READ`.
   */
  listProposalRelationships: openProcedure()
    .input(listProposalRelationshipsInputSchema)
    .output(proposalRelationshipListSchema)
    .query(async ({ ctx, input }) => {
      const { relationships, queriedProposal } =
        await listProposalRelationships({
          sourceProposalId: input.sourceProposalId,
          targetProposalId: input.targetProposalId,
          user: ctx.user,
        });

      // Merge and unmerge register this channel for both ends of the edge.
      ctx.registerQueryChannels([
        Channels.decisionProposal(
          queriedProposal.processInstanceId,
          queriedProposal.id,
        ),
      ]);

      return proposalRelationshipListSchema.parse({ relationships });
    }),
});

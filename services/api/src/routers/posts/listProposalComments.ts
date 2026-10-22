import {
  Channels,
  listProposalComments as listProposalCommentsService,
} from '@op/common';
import { listProposalCommentsSchema, paginated } from '@op/common/client';

import { proposalCommentEncoder } from '../../encoders';
import { openProcedure, router } from '../../trpcFactory';

const outputSchema = paginated(proposalCommentEncoder);

export const listProposalComments = router({
  /**
   * A proposal's comments plus those of every proposal merged into it,
   * interleaved by submission time.
   */
  listProposalComments: openProcedure()
    .input(listProposalCommentsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      const { items, next, profileIds, queriedProposal } =
        await listProposalCommentsService({
          ...input,
          user: ctx.user,
        });

      ctx.registerQueryChannels([
        // Every profile the feed draws from, so a comment left on a merged-away
        // proposal still invalidates this list.
        ...profileIds.map((id) => Channels.profilePosts(id)),
        // Merge and unmerge change which profiles those are, and register this
        // channel for both ends of the edge.
        Channels.decisionProposal(
          queriedProposal.processInstanceId,
          queriedProposal.id,
        ),
      ]);

      return outputSchema.parse({ items, next });
    }),
});

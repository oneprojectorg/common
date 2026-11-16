import { Channels, listReviewProposals } from '@op/common';
import {
  listReviewProposalsInputSchema,
  reviewProposalListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewProposalsRouter = router({
  /** A phase's proposals for review, all or the caller's assigned; `proposal.list` stays review-agnostic. */
  listReviewProposals: networkAuthenticatedProcedure()
    .input(listReviewProposalsInputSchema)
    .output(reviewProposalListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
        // An assigned list changes when the caller's assignments do.
        ...(input.scope === 'assigned'
          ? [Channels.reviewAssignments(input.processInstanceId)]
          : []),
      ]);

      return await listReviewProposals({ ...input, user: ctx.user });
    }),
});

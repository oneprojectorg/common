import { Channels, listReviewProposals } from '@op/common';
import {
  listReviewProposalsInputSchema,
  reviewProposalListSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewProposalsRouter = router({
  /** The review page's "All proposals" list; `proposal.list` stays review-agnostic. */
  listReviewProposals: networkAuthenticatedProcedure()
    .input(listReviewProposalsInputSchema)
    .output(reviewProposalListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.decisionProposals(input.processInstanceId),
      ]);

      return await listReviewProposals({ ...input, user: ctx.user });
    }),
});

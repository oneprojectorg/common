import {
  getProposalWithReviewAggregates,
  getProposalWithReviewAggregatesInputSchema,
  proposalWithSubmittedReviewsSchema,
} from '@op/common';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const getProposalWithReviewAggregatesRouter = router({
  getProposalWithReviewAggregates: commonNetworkProcedure()
    .input(getProposalWithReviewAggregatesInputSchema)
    .output(proposalWithSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      return await getProposalWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

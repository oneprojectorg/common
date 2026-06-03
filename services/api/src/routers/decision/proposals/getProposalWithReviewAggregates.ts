import {
  getProposalWithReviewAggregates,
  getProposalWithReviewAggregatesInputSchema,
  proposalWithSubmittedReviewsSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getProposalWithReviewAggregatesRouter = router({
  getProposalWithReviewAggregates: networkAuthenticatedProcedure()
    .input(getProposalWithReviewAggregatesInputSchema)
    .output(proposalWithSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      return await getProposalWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

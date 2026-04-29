import {
  getProposalWithReviewAggregates,
  getProposalWithReviewAggregatesInputSchema,
  proposalWithSubmittedReviewsSchema,
} from '@op/common';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getProposalWithReviewAggregatesRouter = router({
  getProposalWithReviewAggregates: commonAuthedProcedure()
    .input(getProposalWithReviewAggregatesInputSchema)
    .output(proposalWithSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      return await getProposalWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

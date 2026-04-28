import {
  getProposalWithReviewAggregates,
  getProposalWithReviewAggregatesInputSchema,
  proposalWithSubmittedReviewsSchema,
} from '@op/common';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getWithReviewAggregatesRouter = router({
  getWithReviewAggregates: commonAuthedProcedure()
    .input(getProposalWithReviewAggregatesInputSchema)
    .output(proposalWithSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      return await getProposalWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

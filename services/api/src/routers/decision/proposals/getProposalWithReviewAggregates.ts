import {
  getProposalWithReviewAggregates,
  proposalPhaseRefSchema,
  proposalWithSubmittedReviewsSchema,
} from '@op/common';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getProposalWithReviewAggregatesRouter = router({
  getProposalWithReviewAggregates: commonAuthedProcedure()
    .input(proposalPhaseRefSchema)
    .output(proposalWithSubmittedReviewsSchema)
    .query(async ({ ctx, input }) => {
      return await getProposalWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

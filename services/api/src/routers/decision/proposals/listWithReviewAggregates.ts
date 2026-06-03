import {
  listProposalsWithReviewAggregates,
  listProposalsWithReviewAggregatesInputSchema,
  proposalsWithReviewAggregatesListSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listWithReviewAggregatesRouter = router({
  listWithReviewAggregates: networkAuthenticatedProcedure()
    .input(listProposalsWithReviewAggregatesInputSchema)
    .output(proposalsWithReviewAggregatesListSchema)
    .query(async ({ ctx, input }) => {
      return await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

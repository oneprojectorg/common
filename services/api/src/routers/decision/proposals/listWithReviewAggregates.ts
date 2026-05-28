import {
  listProposalsWithReviewAggregates,
  listProposalsWithReviewAggregatesInputSchema,
  proposalsWithReviewAggregatesListSchema,
} from '@op/common';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const listWithReviewAggregatesRouter = router({
  listWithReviewAggregates: commonNetworkProcedure()
    .input(listProposalsWithReviewAggregatesInputSchema)
    .output(proposalsWithReviewAggregatesListSchema)
    .query(async ({ ctx, input }) => {
      return await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

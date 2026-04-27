import {
  listProposalsWithReviewAggregates,
  listProposalsWithReviewAggregatesInputSchema,
  proposalsWithReviewAggregatesListSchema,
} from '@op/common';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listWithReviewAggregatesRouter = router({
  listWithReviewAggregates: commonAuthedProcedure()
    .input(listProposalsWithReviewAggregatesInputSchema)
    .output(proposalsWithReviewAggregatesListSchema)
    .query(async ({ ctx, input }) => {
      return await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });
    }),
});

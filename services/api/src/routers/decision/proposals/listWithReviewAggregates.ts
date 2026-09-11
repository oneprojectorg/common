import {
  Channels,
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
      const result = await listProposalsWithReviewAggregates({
        ...input,
        user: ctx.user,
      });

      // The instance's assignment channel rather than one proposal channel per
      // row: a page of proposals would otherwise open a subscription each.
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return result;
    }),
});

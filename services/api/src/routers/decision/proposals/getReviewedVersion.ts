import {
  getReviewedProposalVersion,
  getReviewedProposalVersionInputSchema,
} from '@op/common';
import { reviewedProposalVersionSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getReviewedVersionRouter = router({
  /**
   * The version pointers stay server-side: the client names a review, not a
   * proposal history row.
   */
  getReviewedVersion: networkAuthenticatedProcedure()
    .input(getReviewedProposalVersionInputSchema)
    .output(reviewedProposalVersionSchema)
    .query(async ({ ctx, input }) => {
      return await getReviewedProposalVersion({
        reviewId: input.reviewId,
        user: ctx.user,
      });
    }),
});

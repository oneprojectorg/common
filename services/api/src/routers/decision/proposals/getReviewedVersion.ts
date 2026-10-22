import {
  getReviewedProposalVersion,
  getReviewedProposalVersionInputSchema,
} from '@op/common';
import { reviewedProposalVersionSchema } from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getReviewedVersionRouter = router({
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

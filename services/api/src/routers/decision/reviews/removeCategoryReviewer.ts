import {
  categoryReviewerTargetSchema,
  removeCategoryReviewer,
  removeCategoryReviewerResultSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const removeCategoryReviewerRouter = router({
  removeCategoryReviewer: networkAuthenticatedProcedure()
    .input(categoryReviewerTargetSchema)
    .output(removeCategoryReviewerResultSchema)
    .mutation(async ({ ctx, input }) => {
      return await removeCategoryReviewer({
        processInstanceId: input.processInstanceId,
        taxonomyTermId: input.taxonomyTermId,
        reviewerProfileId: input.reviewerProfileId,
        phaseId: input.phaseId,
        user: ctx.user,
      });
    }),
});

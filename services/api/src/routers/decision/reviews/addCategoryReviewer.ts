import {
  addCategoryReviewer,
  categoryReviewerSchema,
  categoryReviewerTargetSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const addCategoryReviewerRouter = router({
  addCategoryReviewer: networkAuthenticatedProcedure()
    .input(categoryReviewerTargetSchema)
    .output(categoryReviewerSchema)
    .mutation(async ({ ctx, input }) => {
      return await addCategoryReviewer({
        processInstanceId: input.processInstanceId,
        taxonomyTermId: input.taxonomyTermId,
        reviewerProfileId: input.reviewerProfileId,
        phaseId: input.phaseId,
        user: ctx.user,
      });
    }),
});

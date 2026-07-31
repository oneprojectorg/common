import {
  instancePhaseRefSchema,
  listReviewerCategories,
  reviewerCategoriesSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewerCategoriesRouter = router({
  listReviewerCategories: networkAuthenticatedProcedure()
    .input(instancePhaseRefSchema)
    .output(reviewerCategoriesSchema)
    .query(async ({ ctx, input }) => {
      return await listReviewerCategories({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        user: ctx.user,
      });
    }),
});

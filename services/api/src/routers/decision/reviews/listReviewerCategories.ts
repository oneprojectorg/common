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
      const categories = await listReviewerCategories({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        user: ctx.user,
      });

      return { items: categories };
    }),
});

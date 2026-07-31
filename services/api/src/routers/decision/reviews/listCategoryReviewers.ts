import {
  categoryReviewersListSchema,
  instanceOptionalPhaseRefSchema,
  listCategoryReviewers,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listCategoryReviewersRouter = router({
  listCategoryReviewers: networkAuthenticatedProcedure()
    .input(instanceOptionalPhaseRefSchema)
    .output(categoryReviewersListSchema)
    .query(async ({ ctx, input }) => {
      const categories = await listCategoryReviewers({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        user: ctx.user,
      });

      return { categories };
    }),
});

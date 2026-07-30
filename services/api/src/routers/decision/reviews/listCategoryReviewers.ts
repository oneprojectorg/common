import { categoryReviewersListSchema, listCategoryReviewers } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listCategoryReviewersRouter = router({
  listCategoryReviewers: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        // '' collides with the NULL instance-wide key under COALESCE(phaseId,'').
        phaseId: z.string().min(1).optional(),
      }),
    )
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

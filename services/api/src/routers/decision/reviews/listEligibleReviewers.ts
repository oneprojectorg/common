import { eligibleReviewersListSchema, listEligibleReviewers } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listEligibleReviewersRouter = router({
  listEligibleReviewers: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        search: z.string().optional(),
      }),
    )
    .output(eligibleReviewersListSchema)
    .query(async ({ ctx, input }) => {
      const reviewers = await listEligibleReviewers({
        processInstanceId: input.processInstanceId,
        search: input.search,
        user: ctx.user,
      });

      return { reviewers };
    }),
});

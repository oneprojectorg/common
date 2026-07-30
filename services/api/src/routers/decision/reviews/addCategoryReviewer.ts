import { addCategoryReviewer, categoryReviewerSchema } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const addCategoryReviewerRouter = router({
  addCategoryReviewer: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        taxonomyTermId: z.uuid(),
        reviewerProfileId: z.uuid(),
        // '' collides with the NULL instance-wide key under COALESCE(phaseId,'').
        phaseId: z.string().min(1).optional(),
      }),
    )
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

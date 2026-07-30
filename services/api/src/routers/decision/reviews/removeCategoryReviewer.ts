import {
  removeCategoryReviewer,
  removeCategoryReviewerResultSchema,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const removeCategoryReviewerRouter = router({
  removeCategoryReviewer: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        taxonomyTermId: z.uuid(),
        reviewerProfileId: z.uuid(),
        // '' collides with the NULL instance-wide key under COALESCE(phaseId,'').
        phaseId: z.string().min(1).optional(),
      }),
    )
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

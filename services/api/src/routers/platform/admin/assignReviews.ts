import { assignReviewsToReviewer } from '@op/common';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

export const assignReviewsRouter = router({
  assignReviews: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        instanceId: z.uuid(),
        phaseId: z.string().min(1),
        reviewerProfileId: z.uuid(),
        proposalIds: z.array(z.uuid()).min(1),
      }),
    )
    .output(z.object({ createdCount: z.number() }))
    .mutation(async ({ input }) => {
      const createdCount = await assignReviewsToReviewer({
        instanceId: input.instanceId,
        phaseId: input.phaseId,
        reviewerProfileId: input.reviewerProfileId,
        proposalIds: input.proposalIds,
      });

      return { createdCount };
    }),
});

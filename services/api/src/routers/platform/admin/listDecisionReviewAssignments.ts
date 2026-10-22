import { getDecisionReviewAssignments } from '@op/common';
import { adminDecisionReviewAssignmentsSchema } from '@op/common/client';
import { z } from 'zod';

import { withAuthenticatedPlatformAdmin } from '../../../middlewares/withAuthenticatedPlatformAdmin';
import withRateLimited from '../../../middlewares/withRateLimited';
import { commonProcedure, router } from '../../../trpcFactory';

export const listDecisionReviewAssignmentsRouter = router({
  listDecisionReviewAssignments: commonProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 30 }))
    .use(withAuthenticatedPlatformAdmin)
    .input(
      z.object({
        instanceId: z.uuid(),
        phaseId: z.string().optional(),
      }),
    )
    .output(adminDecisionReviewAssignmentsSchema)
    .query(({ input }) =>
      getDecisionReviewAssignments({
        instanceId: input.instanceId,
        phaseId: input.phaseId,
      }),
    ),
});

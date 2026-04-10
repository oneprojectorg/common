import { listReviewAssignments, reviewAssignmentListSchema } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentsRouter = router({
  listReviewAssignments: commonAuthedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
      }),
    )
    .output(reviewAssignmentListSchema)
    .query(async ({ ctx, input }) => {
      return await listReviewAssignments({
        processInstanceId: input.processInstanceId,
        user: ctx.user,
      });
    }),
});

import { getReviewAssignment, reviewAssignmentDetailSchema } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getReviewAssignmentRouter = router({
  getReviewAssignment: commonAuthedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
      }),
    )
    .output(reviewAssignmentDetailSchema)
    .query(async ({ ctx, input }) => {
      return reviewAssignmentDetailSchema.parse(
        await getReviewAssignment({
          assignmentId: input.assignmentId,
          user: ctx.user,
        }),
      );
    }),
});

import { getReviewAssignment } from '@op/common';
import { z } from 'zod';

import { reviewAssignmentDetailEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getReviewAssignmentRouter = router({
  getReviewAssignment: commonAuthedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
      }),
    )
    .output(reviewAssignmentDetailEncoder)
    .query(async ({ ctx, input }) => {
      return reviewAssignmentDetailEncoder.parse(
        await getReviewAssignment({
          assignmentId: input.assignmentId,
          user: ctx.user,
        }),
      );
    }),
});

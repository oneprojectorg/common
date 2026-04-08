import { getReviewAssignment } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getReviewAssignmentRouter = router({
  getReviewAssignment: commonAuthedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getReviewAssignment({
        assignmentId: input.assignmentId,
        user: ctx.user,
      });
    }),
});

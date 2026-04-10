import {
  Channels,
  getReviewAssignment,
  reviewAssignmentExtendedSchema,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const getReviewAssignmentRouter = router({
  getReviewAssignment: commonAuthedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
      }),
    )
    .output(reviewAssignmentExtendedSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignment(input.assignmentId),
      ]);

      return await getReviewAssignment({
        assignmentId: input.assignmentId,
        user: ctx.user,
      });
    }),
});

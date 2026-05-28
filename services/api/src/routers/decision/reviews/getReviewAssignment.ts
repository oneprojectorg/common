import {
  Channels,
  getReviewAssignment,
  reviewAssignmentExtendedSchema,
} from '@op/common';
import { z } from 'zod';

import { commonNetworkProcedure, router } from '../../../trpcFactory';

export const getReviewAssignmentRouter = router({
  getReviewAssignment: commonNetworkProcedure()
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

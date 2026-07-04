import {
  Channels,
  listReviewAssignments,
  reviewAssignmentListSchema,
  reviewAssignmentsFilterSchema,
} from '@op/common';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentsRouter = router({
  listReviewAssignments: networkAuthenticatedProcedure()
    .input(reviewAssignmentsFilterSchema)
    .output(reviewAssignmentListSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listReviewAssignments({
        processInstanceId: input.processInstanceId,
        status: input.status,
        dir: input.dir,
        cursor: input.cursor,
        limit: input.limit,
        user: ctx.user,
      });
    }),
});

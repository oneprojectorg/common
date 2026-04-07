import { listReviewAssignments } from '@op/common';
import { z } from 'zod';

import { proposalReviewAssignmentListEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const listReviewAssignmentsRouter = router({
  listReviewAssignments: commonAuthedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
      }),
    )
    .output(proposalReviewAssignmentListEncoder)
    .query(async ({ ctx, input }) => {
      return proposalReviewAssignmentListEncoder.parse(
        await listReviewAssignments({
          processInstanceId: input.processInstanceId,
          user: ctx.user,
        }),
      );
    }),
});

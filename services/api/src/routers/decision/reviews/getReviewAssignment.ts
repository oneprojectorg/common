import {
  Channels,
  getReviewAssignment,
  reviewAssignmentExtendedSchema,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const getReviewAssignmentRouter = router({
  getReviewAssignment: networkAuthenticatedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
      }),
    )
    .output(reviewAssignmentExtendedSchema)
    .query(async ({ ctx, input }) => {
      const result = await getReviewAssignment({
        assignmentId: input.assignmentId,
        user: ctx.user,
      });

      // Also the proposal channel: another reviewer's request or the author's
      // resubmission changes this pane without touching this assignment row.
      ctx.registerQueryChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.decisionProposal(
          result.assignment.processInstanceId,
          result.assignment.proposal.id,
        ),
      ]);

      return result;
    }),
});

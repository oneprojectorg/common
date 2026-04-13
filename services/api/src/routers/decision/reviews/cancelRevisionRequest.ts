import { Channels, cancelRevisionRequest } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const cancelRevisionRequestRouter = router({
  cancelRevisionRequest: commonAuthedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
        revisionRequestId: z.uuid(),
      }),
    )
    .output(proposalReviewRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await cancelRevisionRequest({
        assignmentId: input.assignmentId,
        revisionRequestId: input.revisionRequestId,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(result.processInstanceId),
      ]);

      return proposalReviewRequestSchema.parse(result);
    }),
});

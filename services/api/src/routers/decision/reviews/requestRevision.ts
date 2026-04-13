import { Channels, requestRevision } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const requestRevisionRouter = router({
  requestRevision: commonAuthedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
        requestComment: z.string().min(1),
      }),
    )
    .output(proposalReviewRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await requestRevision({
        assignmentId: input.assignmentId,
        requestComment: input.requestComment,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(result.processInstanceId),
      ]);

      return proposalReviewRequestSchema.parse(result);
    }),
});

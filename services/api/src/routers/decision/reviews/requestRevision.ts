import { Channels, requestRevision } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
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

      // Send revision requested event for notification workflow
      waitUntil(
        inngest.send({
          name: Events.reviewRevisionRequested.name,
          data: {
            assignmentId: input.assignmentId,
            revisionRequestId: result.id,
          },
        }),
      );

      return proposalReviewRequestSchema.parse(result);
    }),
});

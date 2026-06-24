import { Channels, requestRevision } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { Events, safeInngestSend } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const requestRevisionRouter = router({
  requestRevision: networkAuthenticatedProcedure()
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

      // Send revision requested event for notification workflow. Best-effort
      // — publish failures are logged and swallowed; the reviewer-side state
      // change is the source of truth.
      waitUntil(
        safeInngestSend({
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

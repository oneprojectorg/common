import { Channels, submitRevisionResponse } from '@op/common';
import { proposalReviewRequestSchema } from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

export const submitRevisionResponseRouter = router({
  submitRevisionResponse: commonAuthedProcedure()
    .input(
      z.object({
        revisionRequestId: z.uuid(),
        resubmitComment: z.string().trim().optional(),
      }),
    )
    .output(proposalReviewRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await submitRevisionResponse({
        revisionRequestId: input.revisionRequestId,
        resubmitComment: input.resubmitComment,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(result.assignmentId),
        Channels.reviewAssignments(result.processInstanceId),
      ]);

      waitUntil(
        inngest.send({
          name: Events.reviewRevisionResubmitted.name,
          data: { revisionRequestId: result.id },
        }),
      );

      return proposalReviewRequestSchema.parse(result);
    }),
});

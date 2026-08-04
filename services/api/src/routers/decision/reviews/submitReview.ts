import { Channels, submitReview } from '@op/common';
import {
  proposalReviewSchema,
  rubricReviewDataSchema,
} from '@op/common/client';
import { Events, inngest } from '@op/events';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const reviewInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: rubricReviewDataSchema,
  overallComment: z.string().nullable().optional(),
});

export const submitReviewRouter = router({
  submitReview: networkAuthenticatedProcedure()
    .input(reviewInputSchema)
    .output(proposalReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const { review, processInstanceId } = await submitReview({
        assignmentId: input.assignmentId,
        reviewData: input.reviewData,
        overallComment: input.overallComment,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(processInstanceId),
      ]);

      // Confirmation email to the reviewer. Emitted only here (first
      // submission) — updateReview edits must not re-send it.
      waitUntil(
        inngest.send({
          name: Events.reviewSubmitted.name,
          data: {
            assignmentId: input.assignmentId,
          },
        }),
      );

      return proposalReviewSchema.parse(review);
    }),
});

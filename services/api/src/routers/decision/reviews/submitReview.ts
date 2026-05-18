import { Channels, submitReview } from '@op/common';
import {
  proposalReviewSchema,
  rubricReviewDataSchema,
} from '@op/common/client';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';
import {
  trackProposalReviewed,
  trackReviewListFinished,
} from '../../../utils/analytics';

const reviewInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: rubricReviewDataSchema,
  overallComment: z.string().nullable().optional(),
});

export const submitReviewRouter = router({
  submitReview: commonAuthedProcedure()
    .input(reviewInputSchema)
    .output(proposalReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const { review, processInstanceId, proposalId, isLastReview } =
        await submitReview({
          assignmentId: input.assignmentId,
          reviewData: input.reviewData,
          overallComment: input.overallComment,
          user: ctx.user,
        });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(processInstanceId),
      ]);

      waitUntil(trackProposalReviewed(ctx, processInstanceId, proposalId));

      if (isLastReview) {
        waitUntil(trackReviewListFinished(ctx, processInstanceId));
      }

      return proposalReviewSchema.parse(review);
    }),
});

import { Channels, updateReview } from '@op/common';
import {
  proposalReviewSchema,
  rubricReviewDataSchema,
} from '@op/common/client';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const updateReviewInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: rubricReviewDataSchema,
  overallComment: z.string().nullable().optional(),
});

export const updateReviewRouter = router({
  updateReview: networkAuthenticatedProcedure()
    .input(updateReviewInputSchema)
    .output(proposalReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const { review, processInstanceId } = await updateReview({
        assignmentId: input.assignmentId,
        reviewData: input.reviewData,
        overallComment: input.overallComment,
        user: ctx.user,
      });

      ctx.registerMutationChannels([
        Channels.reviewAssignment(input.assignmentId),
        Channels.reviewAssignments(processInstanceId),
      ]);

      return proposalReviewSchema.parse(review);
    }),
});

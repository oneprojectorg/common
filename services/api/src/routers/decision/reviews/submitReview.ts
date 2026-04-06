import { submitReview } from '@op/common';
import { proposalReviewSchema } from '@op/common/client';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const reviewInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: z.record(z.string(), z.unknown()),
  overallComment: z.string().nullable().optional(),
});

export const submitReviewRouter = router({
  submitReview: commonAuthedProcedure()
    .input(reviewInputSchema)
    .output(proposalReviewSchema)
    .mutation(async ({ ctx, input }) => {
      return proposalReviewSchema.parse(
        await submitReview({
          assignmentId: input.assignmentId,
          reviewData: input.reviewData,
          overallComment: input.overallComment,
          user: ctx.user,
        }),
      );
    }),
});

import { saveReviewDraft } from '@op/common';
import { z } from 'zod';

import { proposalReviewEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const reviewInputSchema = z.object({
  assignmentId: z.uuid(),
  reviewData: z.record(z.string(), z.unknown()),
  overallComment: z.string().nullable().optional(),
});

export const saveReviewDraftRouter = router({
  saveReviewDraft: commonAuthedProcedure()
    .input(reviewInputSchema)
    .output(proposalReviewEncoder)
    .mutation(async ({ ctx, input }) => {
      return proposalReviewEncoder.parse(
        await saveReviewDraft({
          assignmentId: input.assignmentId,
          reviewData: input.reviewData,
          overallComment: input.overallComment,
          user: ctx.user,
        }),
      );
    }),
});

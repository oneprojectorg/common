import { SUPPORTED_LOCALES, translateReview } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const translateReviewRouter = router({
  // Matches `decision.getReviewAssignment` and
  // `decision.getProposalWithReviewAggregates`, which serve submitted reviews.
  translateReview: networkAuthenticatedProcedure()
    .input(
      z.object({
        reviewId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        rationales: z.record(z.string(), z.string()),
        overallComment: z.string().optional(),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translateReview({
        reviewId: input.reviewId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

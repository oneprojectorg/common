import { SUPPORTED_LOCALES, translateReviews } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

/** One review's translated prose, keyed by review id in the response. */
const reviewTranslationSchema = z.object({
  overallComment: z.string().optional(),
  rationales: z.record(z.string(), z.string()),
  answers: z.record(z.string(), z.string()),
});

const translateReviewsOutput = z.object({
  translations: z.record(z.uuid(), reviewTranslationSchema),
  sourceLocale: z.string(),
  targetLocale: z.enum(SUPPORTED_LOCALES),
});

export const translateReviewsRouter = router({
  // Same tier as its rubric siblings, and the service reuses the read gate of
  // `decision.getProposalWithReviewAggregates` — the query that put these
  // reviews on screen in the first place.
  translateReviews: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        proposalId: z.uuid(),
        // Optional for the same reason the aggregates query allows it: an admin
        // may address the instance's current phase without naming it.
        phaseId: z.string().min(1).optional(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateReviewsOutput)
    .mutation(async ({ input, ctx }) => {
      return translateReviews({
        processInstanceId: input.processInstanceId,
        proposalId: input.proposalId,
        phaseId: input.phaseId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

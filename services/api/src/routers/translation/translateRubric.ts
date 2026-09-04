import { SUPPORTED_LOCALES, translateRubric } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { translateOutput } from './translateProposal';

export const translateRubricRouter = router({
  // Not `openProcedure` like its sibling translation endpoints: a rubric is only
  // ever reachable through a review assignment, so this matches the tier of
  // `decision.getReviewAssignment`, which serves the same rubric.
  translateRubric: networkAuthenticatedProcedure()
    .input(
      z.object({
        assignmentId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ input, ctx }) => {
      return translateRubric({
        assignmentId: input.assignmentId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

import { SUPPORTED_LOCALES, translatePhaseRubric } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';
import { translateOutput } from './translateProposal';

export const translatePhaseRubricRouter = router({
  // Same tier as `translateRubric`, and the service applies the same gate the
  // assignment list uses (instance admin or reviewer). This variant exists for
  // the admin review summary, which shows a phase's rubric without holding an
  // assignment to address it by.
  translatePhaseRubric: networkAuthenticatedProcedure()
    .input(
      z.object({
        processInstanceId: z.uuid(),
        phaseId: z.string().min(1),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ input, ctx }) => {
      return translatePhaseRubric({
        processInstanceId: input.processInstanceId,
        phaseId: input.phaseId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

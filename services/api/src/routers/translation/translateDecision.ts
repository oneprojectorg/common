import { SUPPORTED_LOCALES, translateDecision } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { translateOutput } from './translateProposal';

export const translateDecisionRouter = router({
  translateDecision: commonAuthedProcedure()
    .input(
      z.object({
        decisionProfileId: z.string().uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ input, ctx }) => {
      return translateDecision({
        decisionProfileId: input.decisionProfileId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

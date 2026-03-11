import { SUPPORTED_LOCALES, translateDecision } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

const translateDecisionOutput = z.object({
  headline: z.string().optional(),
  phaseDescription: z.string().optional(),
  additionalInfo: z.string().optional(),
  description: z.string().optional(),
  phases: z.array(z.object({ id: z.string(), name: z.string() })),
  sourceLocale: z.string(),
  targetLocale: z.enum(SUPPORTED_LOCALES),
});

export const translateDecisionRouter = router({
  translateDecision: commonAuthedProcedure()
    .input(
      z.object({
        decisionProfileId: z.string().uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateDecisionOutput)
    .mutation(async ({ input, ctx }) => {
      return translateDecision({
        decisionProfileId: input.decisionProfileId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

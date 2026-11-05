import { SUPPORTED_LOCALES, translateCustomForm } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';
import { translateOutput } from './translateProposal';

export const translateCustomFormRouter = router({
  // Same tier and limit as `customForm.getForProfile`, which already returns
  // the form's text to any signed-in caller.
  translateCustomForm: authenticatedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 100 },
  })
    .input(
      z.object({
        customFormId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ input }) => {
      return translateCustomForm({
        customFormId: input.customFormId,
        targetLocale: input.targetLocale,
      });
    }),
});

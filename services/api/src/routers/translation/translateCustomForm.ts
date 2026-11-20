import { SUPPORTED_LOCALES, translateCustomForm } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';
import { translateOutput } from './translateProposal';

export const translateCustomFormRouter = router({
  // Same tier as `customForm.getForProfile`. Both require read access to the
  // decision the form belongs to.
  translateCustomForm: authenticatedProcedure()
    .input(
      z.object({
        customFormId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(translateOutput)
    .mutation(async ({ ctx, input }) => {
      return translateCustomForm({
        user: ctx.user,
        customFormId: input.customFormId,
        targetLocale: input.targetLocale,
      });
    }),
});

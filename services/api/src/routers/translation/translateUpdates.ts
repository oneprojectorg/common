import { SUPPORTED_LOCALES, translateUpdates } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

export const translateUpdatesRouter = router({
  translateUpdates: openProcedure()
    .input(
      z.object({
        decisionProfileId: z.string().uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        translations: z.record(
          z.string(),
          z.object({ content: z.string().optional() }),
        ),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translateUpdates({
        decisionProfileId: input.decisionProfileId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

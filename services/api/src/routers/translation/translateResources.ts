import { SUPPORTED_LOCALES, translateResources } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

export const translateResourcesRouter = router({
  translateResources: openProcedure()
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
          z.object({
            title: z.string().optional(),
            description: z.string().optional(),
          }),
        ),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translateResources({
        decisionProfileId: input.decisionProfileId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

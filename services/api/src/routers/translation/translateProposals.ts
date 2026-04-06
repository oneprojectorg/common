import { SUPPORTED_LOCALES, translateProposals } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const translateProposalsRouter = router({
  translateProposals: commonAuthedProcedure()
    .input(
      z.object({
        profileIds: z.array(z.uuid()).min(1).max(100),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        translations: z.record(
          z.string(),
          z.object({
            title: z.string().optional(),
            category: z.array(z.string()).optional(),
            preview: z.string().optional(),
          }),
        ),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translateProposals({
        profileIds: input.profileIds,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

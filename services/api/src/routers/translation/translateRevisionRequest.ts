import { SUPPORTED_LOCALES, translateRevisionRequest } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

export const translateRevisionRequestRouter = router({
  translateRevisionRequest: authenticatedProcedure()
    .input(
      z.object({
        requestId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        requestComment: z.string().optional(),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translateRevisionRequest({
        requestId: input.requestId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

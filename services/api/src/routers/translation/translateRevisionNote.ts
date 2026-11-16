import { SUPPORTED_LOCALES, translateRevisionNote } from '@op/common';
import { z } from 'zod';

import { authenticatedProcedure, router } from '../../trpcFactory';

export const translateRevisionNoteRouter = router({
  translateRevisionNote: authenticatedProcedure()
    .input(
      z.object({
        requestId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        responseComment: z.string().optional(),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translateRevisionNote({
        requestId: input.requestId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

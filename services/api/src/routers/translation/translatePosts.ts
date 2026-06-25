import { SUPPORTED_LOCALES, translatePosts } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

export const translatePostsRouter = router({
  translatePosts: openProcedure()
    .input(
      z.object({
        profileId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        translations: z.record(
          z.string(),
          z.object({
            content: z.string(),
          }),
        ),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translatePosts({
        profileId: input.profileId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

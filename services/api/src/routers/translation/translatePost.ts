import { SUPPORTED_LOCALES, translatePost } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

export const translatePostRouter = router({
  // Same tier as `posts.listProposalComments` / `posts.listProfilePosts`, the
  // feeds this post is read through; the service gates the post itself.
  translatePost: openProcedure()
    .input(
      z.object({
        postId: z.uuid(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .output(
      z.object({
        content: z.string().optional(),
        sourceLocale: z.string(),
        targetLocale: z.enum(SUPPORTED_LOCALES),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return translatePost({
        postId: input.postId,
        targetLocale: input.targetLocale,
        user: ctx.user,
      });
    }),
});

import { getLinkPreview, httpUrlSchema } from '@op/common';
import { z } from 'zod';

import { openProcedure, router } from '../../trpcFactory';

const linkPreviewResponseSchema = z.object({
  url: z.string(),
  meta: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      author: z.string().optional(),
      site: z.string().optional(),
    })
    .optional(),
  html: z.string().optional(),
  // `getLinkPreview` already strips non-http(s) values; keep `.url()` here as
  // a wire-level guard so we don't accidentally widen the contract later.
  thumbnail_url: z.string().url().optional(),
  provider_name: z.string().optional(),
  provider_url: z.string().url().optional(),
  error: z.string().optional(),
});

export const linkPreview = router({
  linkPreview: openProcedure()
    .input(z.object({ url: httpUrlSchema }))
    .output(linkPreviewResponseSchema)
    .query(async ({ input }) => {
      const result = await getLinkPreview(input.url);

      return linkPreviewResponseSchema.parse(result);
    }),
});

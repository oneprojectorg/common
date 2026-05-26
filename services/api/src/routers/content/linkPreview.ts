import { getLinkPreview, httpUrlSchema } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

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
  thumbnail_url: z.string().optional(),
  provider_name: z.string().optional(),
  provider_url: z.string().optional(),
  error: z.string().optional(),
});

export const linkPreview = router({
  linkPreview: commonAuthedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 30 },
  })
    .input(z.object({ url: httpUrlSchema }))
    .output(linkPreviewResponseSchema)
    .query(async ({ input }) => {
      const result = await getLinkPreview(input.url);

      return linkPreviewResponseSchema.parse(result);
    }),
});

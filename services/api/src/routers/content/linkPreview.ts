import { z } from 'zod';

import { loggedProcedure, router } from '../../trpcFactory';

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
  linkPreview: loggedProcedure
    .input(
      z.object({
        url: z.string().url(),
      }),
    )
    .output(linkPreviewResponseSchema)
    .query(async ({ input }) => {
      try {
        const apiKey = process.env.IFRAMELY_API_KEY;

        if (!apiKey) {
          return {
            url: input.url,
            error: 'Iframely API key not configured',
          };
        }

        // TODO: add caching
        const response = await fetch(
          `https://cdn.iframe.ly/api/iframely?omit_script=1&consent=1&url=${encodeURIComponent(input.url)}&api_key=${apiKey}`,
        );

        if (!response.ok) {
          return {
            url: input.url,
            error: `Failed to fetch preview: ${response.status}`,
          };
        }

        const data = await response.json();

        return {
          url: input.url,
          meta: data.meta
            ? {
                title: data.meta.title,
                description: data.meta.description,
                author: data.meta.author,
                site: data.meta.site,
              }
            : undefined,
          html: data.html,
          thumbnail_url: data.thumbnail_url,
          provider_name: data.provider_name,
          provider_url: data.provider_url,
        };
      } catch (error) {
        return {
          url: input.url,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }),
});

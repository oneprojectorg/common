// import { cache } from '@op/cache';
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

const getLinkPreview = async (url: string) => {
  try {
    const apiKey = process.env.IFRAMELY_API_KEY;

    if (!apiKey) {
      return {
        url,
        error: 'Iframely API key not configured',
      };
    }

    // TODO: add caching
    const response = await fetch(
      `https://cdn.iframe.ly/api/iframely?omit_script=1&consent=1&url=${encodeURIComponent(url)}&api_key=${apiKey}`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      url,
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
      url,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const linkPreview = router({
  linkPreview: commonAuthedProcedure()
    .input(
      z.object({
        url: z.url(),
      }),
    )
    .output(linkPreviewResponseSchema)
    .query(async ({ input }) => {
      // TODO: disabling caching to find a better cache-key
      // const result = await cache({
      // type: 'linkPreview',
      // params: [input.url],
      // fetch: () => getLinkPreview(input.url),
      // options: {
      // ttl: 30 * 24 * 60 * 60 * 1000,
      // },
      // });

      const result = await getLinkPreview(input.url);

      return linkPreviewResponseSchema.parse(result);
    }),
});

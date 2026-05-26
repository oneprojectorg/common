export type LinkPreviewResult = {
  url: string;
  meta?: {
    title?: string;
    description?: string;
    author?: string;
    site?: string;
  };
  html?: string;
  thumbnail_url?: string;
  provider_name?: string;
  provider_url?: string;
  error?: string;
};

// Iframely-backed link metadata fetch. Best-effort: returns an object with
// `error` set on failure instead of throwing, so callers can persist the
// resource even when OG snapshotting fails.
export const getLinkPreview = async (
  url: string,
): Promise<LinkPreviewResult> => {
  try {
    const iframelyKey =
      process.env.IFRAMELY_KEY ?? process.env.IFRAMELY_API_KEY;
    if (!iframelyKey) {
      return { url, error: 'Iframely key not configured' };
    }

    const response = await fetch(
      `https://iframe.ly/api/iframely?url=${encodeURIComponent(url)}&key=${iframelyKey}`,
    );

    if (!response.ok) {
      return { url, error: `Iframely responded ${response.status}` };
    }

    const data = await response.json();

    // The `/api/iframely` endpoint returns thumbnails under `links.thumbnail[]`
    // (the oEmbed-shaped top-level `thumbnail_url` is only on `/api/oembed`).
    // Prefer the first entry; fall back to top-level for forward-compat with
    // any future shape change.
    const thumbnailHref = Array.isArray(data.links?.thumbnail)
      ? data.links.thumbnail.find(
          (l: { href?: unknown }) => typeof l?.href === 'string',
        )?.href
      : undefined;

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
      thumbnail_url: thumbnailHref ?? data.thumbnail_url,
      provider_name: data.provider_name ?? data.meta?.site,
      provider_url: data.provider_url ?? data.meta?.canonical,
    };
  } catch (error) {
    return {
      url,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

import { cache } from '@op/cache';

export type LinkPreviewResult = {
  url: string;
  meta?: {
    title?: string;
    description?: string;
    author?: string;
    site?: string;
  };
  // Iframely-supplied embed HTML. Rendered by the existing <LinkPreview>
  // component via dangerouslySetInnerHTML. Kept as-is for back-compat with
  // Posts/Proposals; new callers (e.g. resource cards) should not render it.
  html?: string;
  thumbnail_url?: string;
  provider_name?: string;
  provider_url?: string;
  error?: string;
};

// Iframely is per-request billed.
const LINK_PREVIEW_TTL_MS = 60 * 60 * 1000;

// Iframely-returned URLs are user-influenced (the destination URL the user
// submitted controls what their site advertises in meta tags). Strip
// anything that isn't a plain http(s) absolute URL before it leaves this
// boundary so callers can't accidentally render `javascript:`/`data:`/etc.
const sanitizeExternalUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
};

// Best-effort: returns `{ error }` instead of throwing so callers can still
// persist the resource when snapshotting fails.
export const getLinkPreview = async (
  url: string,
): Promise<LinkPreviewResult> => {
  return cache({
    type: 'linkPreview',
    params: [url],
    fetch: () => fetchLinkPreview(url),
    options: {
      ttl: LINK_PREVIEW_TTL_MS,
      skipCacheWrite: (result) => result.error !== undefined,
    },
  });
};

const fetchLinkPreview = async (url: string): Promise<LinkPreviewResult> => {
  try {
    const iframelyKey = process.env.IFRAMELY_KEY;
    if (!iframelyKey) {
      return { url, error: 'Iframely key not configured' };
    }

    // Cap upstream latency: an authenticated user can DoS the API by
    // submitting URLs that iframely is slow to resolve. 5s is a reasonable
    // ceiling; the user gets {error: 'timeout'} on cache miss.
    const response = await fetch(
      `https://iframe.ly/api/iframely?url=${encodeURIComponent(url)}&key=${iframelyKey}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) {
      return { url, error: `Iframely responded ${response.status}` };
    }

    const data = await response.json();

    // `/api/iframely` puts thumbnails under `links.thumbnail[]`; top-level
    // `thumbnail_url` only exists on `/api/oembed`.
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
      thumbnail_url: sanitizeExternalUrl(thumbnailHref ?? data.thumbnail_url),
      provider_name: data.provider_name ?? data.meta?.site,
      provider_url: sanitizeExternalUrl(
        data.provider_url ?? data.meta?.canonical,
      ),
    };
  } catch (error) {
    // Never echo the upstream error message: the fetch URL embeds
    // IFRAMELY_KEY and some node fetch error paths include the request URL
    // in the message. Log server-side, return a generic message.
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { url, error: 'Link preview timed out' };
    }
    return { url, error: 'Link preview failed' };
  }
};

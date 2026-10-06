const IFRAMELY_CDN_ORIGIN = 'https://cdn.iframe.ly';

// Matches getLinkPreview's upstream ceiling: an embed URL a viewer controls
// must not be able to hold a serverless function open indefinitely.
const UPSTREAM_TIMEOUT_MS = 5_000;

// Long edge cache is the point of the proxy: each unique embed hits iframely
// once per cache window instead of once per billed view.
const EMBED_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400';

export const proxyIframelyCdn = async ({
  path,
  search,
  responseHeaders,
}: {
  path: string;
  search: string;
  responseHeaders: Record<string, string>;
}): Promise<Response> => {
  try {
    // Fixed upstream origin + path — only the query string is forwarded, so
    // this cannot be used as an open proxy to arbitrary hosts.
    const upstream = await fetch(`${IFRAMELY_CDN_ORIGIN}${path}${search}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return new Response(null, {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'text/html; charset=utf-8',
        'Cache-Control': EMBED_CACHE_CONTROL,
        ...responseHeaders,
      },
    });
  } catch {
    return new Response(null, {
      status: 504,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
};

// The embed document is arbitrary third-party HTML/JS. Auth cookies are
// Domain=.oneproject.* and CORS allowlists oneproject.* origins, so served
// plainly from our own host (or any subdomain) an embed script could call
// the API with the viewer's credentials. The CSP sandbox (without
// allow-same-origin) gives the document an opaque origin instead: no cookie
// or storage access, and its requests carry `Origin: null`, which fails the
// API's CORS check.
const EMBED_SANDBOX_CSP =
  'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';

/** GET /api/embeds/api/iframe — iframely's embed document, sandboxed. */
export const getEmbedIframe = (request: Request) =>
  proxyIframelyCdn({
    path: '/api/iframe',
    search: new URL(request.url).search,
    responseHeaders: {
      'Content-Security-Policy': EMBED_SANDBOX_CSP,
      'X-Content-Type-Options': 'nosniff',
    },
  });

/** GET /api/embeds/embed.js — iframely's embed script. */
export const getEmbedJs = (request: Request) =>
  proxyIframelyCdn({
    path: '/embed.js',
    search: new URL(request.url).search,
    responseHeaders: {
      'Content-Type': 'text/javascript; charset=utf-8',
    },
  });

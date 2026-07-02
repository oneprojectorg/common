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

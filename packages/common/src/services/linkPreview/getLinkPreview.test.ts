import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getLinkPreview } from './getLinkPreview';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.IFRAMELY_KEY;
const ORIGINAL_API_URL = process.env.IFRAMELY_API_URL;
const ORIGINAL_CDN_URL = process.env.IFRAMELY_CDN_URL;

const restoreEnv = (name: string, original: string | undefined) => {
  if (original === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = original;
  }
};

const uniqueUrl = (slug: string) =>
  `https://example.com/${slug}-${Date.now()}-${Math.random()}`;

describe('getLinkPreview', () => {
  beforeEach(() => {
    process.env.IFRAMELY_KEY = 'test-secret-key-do-not-leak';
    delete process.env.IFRAMELY_API_URL;
    delete process.env.IFRAMELY_CDN_URL;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    restoreEnv('IFRAMELY_KEY', ORIGINAL_KEY);
    restoreEnv('IFRAMELY_API_URL', ORIGINAL_API_URL);
    restoreEnv('IFRAMELY_CDN_URL', ORIGINAL_CDN_URL);
  });

  it('returns a generic error when fetch throws — no upstream message echo', async () => {
    const url = uniqueUrl('throw');
    globalThis.fetch = vi.fn(async () => {
      throw new Error(
        'connect ECONNREFUSED https://iframe.ly/api/iframely?url=foo&key=test-secret-key-do-not-leak',
      );
    });

    const result = await getLinkPreview(url);

    expect(result.error).toBe('Link preview failed');
  });

  it('returns a timeout-specific error when fetch is aborted by AbortSignal.timeout', async () => {
    const url = uniqueUrl('timeout');
    globalThis.fetch = vi.fn(async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    });

    const result = await getLinkPreview(url);

    expect(result.error).toBe('Link preview timed out');
  });

  it('returns a generic error when iframely responds non-2xx — no upstream body leak', async () => {
    const url = uniqueUrl('non-2xx');
    globalThis.fetch = vi.fn(async () => {
      return new Response('Internal server error from iframely', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    });

    const result = await getLinkPreview(url);

    expect(result.error).toBe('Iframely responded 500');
    expect(result.error).not.toContain('Internal server error from iframely');
  });

  it('returns "Iframely key not configured" when IFRAMELY_KEY is not set', async () => {
    delete process.env.IFRAMELY_KEY;
    const url = uniqueUrl('no-key');

    const result = await getLinkPreview(url);

    expect(result.error).toBe('Iframely key not configured');
  });

  it('parses meta/thumbnail/provider from a successful iframely response', async () => {
    const url = uniqueUrl('success');
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          meta: {
            title: 'A Title',
            description: 'A description',
            author: 'Anne Author',
            site: 'example.com',
            canonical: 'https://example.com/canonical',
          },
          html: '<iframe src="https://example.com"></iframe>',
          links: {
            thumbnail: [{ href: 'https://cdn.example.com/thumb.png' }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    globalThis.fetch = fetchSpy;

    const result = await getLinkPreview(url);

    expect(result.error).toBeUndefined();
    expect(result.meta?.title).toBe('A Title');
    expect(result.html).toBe('<iframe src="https://example.com"></iframe>');
    expect(result.thumbnail_url).toBe('https://cdn.example.com/thumb.png');
    expect(result.provider_name).toBe('example.com');
    expect(result.provider_url).toBe('https://example.com/canonical');

    // Verifies the integration — wrong endpoint, missing key, or a dropped
    // timeout signal would otherwise pass every other test in this file.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('https://iframe.ly/api/iframely');
    expect(calledUrl).toContain(`url=${encodeURIComponent(url)}`);
    expect(calledUrl).toContain('key=test-secret-key-do-not-leak');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns undefined thumbnail when links.thumbnail is empty or malformed', async () => {
    const url = uniqueUrl('no-thumb');
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          meta: { title: 'No Thumb' },
          links: { thumbnail: [{}, { href: 123 }] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const result = await getLinkPreview(url);

    expect(result.error).toBeUndefined();
    expect(result.thumbnail_url).toBeUndefined();
  });

  it('fetches from IFRAMELY_API_URL without a key when only the proxy is configured', async () => {
    delete process.env.IFRAMELY_KEY;
    process.env.IFRAMELY_API_URL = 'https://embeds.example.org/api/iframely';
    const url = uniqueUrl('proxy');
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify({ meta: { title: 'Proxied' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy;

    const result = await getLinkPreview(url);

    expect(result.error).toBeUndefined();
    expect(result.meta?.title).toBe('Proxied');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain(
      `https://embeds.example.org/api/iframely?url=${encodeURIComponent(url)}`,
    );
    expect(calledUrl).not.toContain('key=');
  });

  it('still appends the key to IFRAMELY_API_URL when both are configured', async () => {
    process.env.IFRAMELY_API_URL = 'https://embeds.example.org/api/iframely';
    const url = uniqueUrl('proxy-with-key');
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify({ meta: { title: 'Proxied' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy;

    await getLinkPreview(url);

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain('https://embeds.example.org/api/iframely?url=');
    expect(calledUrl).toContain('key=test-secret-key-do-not-leak');
  });

  it('rewrites cdn.iframe.ly references in embed html to IFRAMELY_CDN_URL', async () => {
    // Trailing slash must be stripped so the rewrite doesn't produce `//api/...`.
    process.env.IFRAMELY_CDN_URL = 'https://embeds.example.org/';
    const url = uniqueUrl('cdn-rewrite');
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          html: '<a data-iframely-url="//cdn.iframe.ly/api/iframe?url=x"></a><iframe src="https://cdn.iframe.ly/api/iframe?url=x"></iframe><script src="//cdn.iframe.ly/embed.js"></script><img src="https://other.example.com/pic.png">',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const result = await getLinkPreview(url);

    expect(result.error).toBeUndefined();
    expect(result.html).toBe(
      '<a data-iframely-url="https://embeds.example.org/api/iframe?url=x"></a><iframe src="https://embeds.example.org/api/iframe?url=x"></iframe><script src="https://embeds.example.org/embed.js"></script><img src="https://other.example.com/pic.png">',
    );
  });

  it('leaves embed html untouched when IFRAMELY_CDN_URL is not set', async () => {
    const url = uniqueUrl('cdn-passthrough');
    const html =
      '<iframe src="https://cdn.iframe.ly/api/iframe?url=x"></iframe>';
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ html }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await getLinkPreview(url);

    expect(result.html).toBe(html);
  });

  it('falls back to top-level thumbnail_url/provider_name/provider_url when links.thumbnail and meta canonical/site are absent', async () => {
    const url = uniqueUrl('top-level-fallback');
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          meta: { title: 'Top Level' },
          thumbnail_url: 'https://cdn.example.com/top.png',
          provider_name: 'Example Provider',
          // Path-bearing so the assertion is exact: a bare origin like
          // `https://example.com` round-trips to `https://example.com/`.
          provider_url: 'https://example.com/provider',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    globalThis.fetch = fetchSpy;

    const result = await getLinkPreview(url);

    // Anchor to the mock: if a real/leaked fetch produced this result the spy
    // wouldn't have run, so the fields below wouldn't be our fixture values.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.thumbnail_url).toBe('https://cdn.example.com/top.png');
    expect(result.provider_name).toBe('Example Provider');
    expect(result.provider_url).toBe('https://example.com/provider');
  });
});

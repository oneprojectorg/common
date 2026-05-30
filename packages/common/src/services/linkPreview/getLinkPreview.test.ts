import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getLinkPreview } from './getLinkPreview';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.IFRAMELY_KEY;

const uniqueUrl = (slug: string) =>
  `https://example.com/${slug}-${Date.now()}-${Math.random()}`;

describe('getLinkPreview', () => {
  beforeEach(() => {
    process.env.IFRAMELY_KEY = 'test-secret-key-do-not-leak';
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_KEY === undefined) {
      delete process.env.IFRAMELY_KEY;
    } else {
      process.env.IFRAMELY_KEY = ORIGINAL_KEY;
    }
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

  it('falls back to top-level thumbnail_url/provider_name/provider_url when links.thumbnail and meta canonical/site are absent', async () => {
    const url = uniqueUrl('top-level-fallback');
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          meta: { title: 'Top Level' },
          thumbnail_url: 'https://cdn.example.com/top.png',
          provider_name: 'Example Provider',
          provider_url: 'https://example.com',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const result = await getLinkPreview(url);

    expect(result.error).toBeUndefined();
    expect(result.thumbnail_url).toBe('https://cdn.example.com/top.png');
    expect(result.provider_name).toBe('Example Provider');
    expect(result.provider_url).toBe('https://example.com');
  });
});

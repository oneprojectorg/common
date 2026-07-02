import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET as getIframe } from './api/iframe/route';
import { GET as getEmbedJs } from './embed.js/route';
import { proxyIframelyCdn } from './proxyIframelyCdn';

const ORIGINAL_FETCH = globalThis.fetch;

const mockUpstreamFetch = (handler: () => Promise<Response>) => {
  const fetchSpy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => handler(),
  );
  globalThis.fetch = fetchSpy;
  return fetchSpy;
};

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('proxyIframelyCdn', () => {
  it('fetches the fixed cdn.iframe.ly origin with path + forwarded search', async () => {
    const fetchSpy = mockUpstreamFetch(async () => {
      return new Response('<html>widget</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });

    const response = await proxyIframelyCdn({
      path: '/api/iframe',
      search: '?url=https%3A%2F%2Fexample.com&key=abc123',
      responseHeaders: {},
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe(
      'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Fexample.com&key=abc123',
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html>widget</html>');
    expect(response.headers.get('cache-control')).toContain('s-maxage=');
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    );
  });

  it('returns an uncacheable 502 when upstream responds non-2xx', async () => {
    mockUpstreamFetch(async () => {
      return new Response('upstream error detail', { status: 403 });
    });

    const response = await proxyIframelyCdn({
      path: '/api/iframe',
      search: '?url=x',
      responseHeaders: {},
    });

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });

  it('returns an uncacheable 504 when upstream fetch throws', async () => {
    mockUpstreamFetch(async () => {
      throw new Error('timeout');
    });

    const response = await proxyIframelyCdn({
      path: '/embed.js',
      search: '',
      responseHeaders: {},
    });

    expect(response.status).toBe(504);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /api/embeds/api/iframe', () => {
  it('serves the widget under a CSP sandbox without allow-same-origin', async () => {
    const fetchSpy = mockUpstreamFetch(async () => {
      return new Response('<html>widget</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });

    const request = new NextRequest(
      'https://app.example.org/api/embeds/api/iframe?url=https%3A%2F%2Fexample.com&key=abc',
    );
    const response = await getIframe(request);

    const [calledUrl] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe(
      'https://cdn.iframe.ly/api/iframe?url=https%3A%2F%2Fexample.com&key=abc',
    );

    const csp = response.headers.get('content-security-policy');
    expect(csp).toContain('sandbox');
    expect(csp).not.toContain('allow-same-origin');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('GET /api/embeds/embed.js', () => {
  it('serves embed.js from the fixed upstream with a script content type', async () => {
    const fetchSpy = mockUpstreamFetch(async () => {
      return new Response('window.iframely = {};', {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      });
    });

    const request = new NextRequest(
      'https://app.example.org/api/embeds/embed.js',
    );
    const response = await getEmbedJs(request);

    const [calledUrl] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('https://cdn.iframe.ly/embed.js');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    );
    expect(await response.text()).toBe('window.iframely = {};');
  });
});

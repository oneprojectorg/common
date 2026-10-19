// The proxy stands in for next-intl's middleware on prefixed paths, so it owns
// the locale header its server APIs read. Matcher: proxy.test.ts; CSP: proxyCsp.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClaims = vi.fn();
const setAllCookies = vi.fn();

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), flush: vi.fn() },
  transformMiddlewareRequest: () => ['request'],
}));

vi.mock('@op/supabase/lib', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: Array<{ name: string; value: string; options: object }>,
        ) => void;
      };
    },
  ) => {
    setAllCookies.mockImplementation(options.cookies.setAll);

    return { auth: { getClaims } };
  },
}));

vi.mock('next-intl/middleware', () => ({
  default: () => (request: Request) =>
    NextResponse.next({ request: { headers: request.headers } }),
}));

vi.mock('./lib/i18n', () => ({
  i18nConfig: { locales: ['en', 'es'] },
  routing: {},
}));

const { NextRequest, NextResponse } = await import('next/server');
const { NextFetchEvent } =
  await import('next/dist/server/web/spec-extension/fetch-event');
const { proxy } = await import('./proxy');

const run = (path: string, cookies: Record<string, string> = {}) => {
  const request = new NextRequest(`https://common.oneproject.org${path}`);

  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }

  return proxy(
    request,
    new NextFetchEvent({ request, page: path, context: undefined }),
  );
};

/** `NextResponse.next({ request })` encodes forwarded headers like this. */
const getForwardedLocale = (response: Response) =>
  response.headers.get('x-middleware-request-x-next-intl-locale');

beforeEach(() => {
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: 'user' } } });
});

describe('proxy request locale', () => {
  it.each([
    ['/es/decisions', 'es'],
    ['/es', 'es'],
    ['/en/start', 'en'],
  ])(
    'forwards the locale prefix of %s as the request locale',
    async (path, locale) => {
      const response = await run(path);

      expect(getForwardedLocale(response)).toBe(locale);
    },
  );

  it('keeps forwarding the locale when a token refresh rebuilds the response', async () => {
    getClaims.mockImplementation(async () => {
      setAllCookies([
        { name: 'sb-access-token', value: 'refreshed', options: {} },
      ]);

      return { data: { claims: { sub: 'user' } } };
    });

    const response = await run('/es/decisions', { 'sb-access-token': 'stale' });

    expect(setAllCookies).toHaveBeenCalled();
    expect(getForwardedLocale(response)).toBe('es');
  });

  it('forwards no locale for an unprefixed path, which keeps the default', async () => {
    // Anonymous `/` is the one unprefixed path the proxy serves itself; any
    // other goes through the (mocked) i18n redirect, which copies headers.
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await run('/');

    expect(getForwardedLocale(response)).toBeNull();
  });
});

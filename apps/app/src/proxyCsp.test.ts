/**
 * Behavioural tests for the Content-Security-Policy the proxy emits.
 *
 * The matcher tests live in `proxy.test.ts`; this file drives the proxy
 * function itself, because the nonce contract spans two places that are easy
 * to break independently: the *response* header the browser enforces, and the
 * *request* header Next reads the nonce back out of. If those two disagree,
 * the page renders with scripts the policy refuses and the user gets a blank
 * screen — which no header-only assertion would catch.
 */
import type { NextFetchEvent, NextRequest } from 'next/server';
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
    // Hand the cookie adapter back to the test so a case can drive the
    // token-refresh path the way GoTrue does.
    setAllCookies.mockImplementation(options.cookies.setAll);

    return { auth: { getClaims } };
  },
}));

// Forwards the request headers the way the real next-intl middleware does, so
// assertions on `x-middleware-request-*` mean something on the redirect path
// too. A bare `NextResponse.next()` here makes them vacuously null.
vi.mock('next-intl/middleware', () => ({
  default: () => (request: NextRequest) =>
    NextResponse.next({ request: { headers: request.headers } }),
}));

// `./lib/i18n` re-exports next-intl's client navigation, which resolves
// `next/navigation` in a way the node test environment cannot. The proxy only
// reads the locale list off it.
vi.mock('./lib/i18n', () => ({
  i18nConfig: { locales: ['en', 'es'] },
  routing: {},
}));

const { NextResponse } = await import('next/server');
const { proxy } = await import('./proxy');

const buildRequest = (url: string): NextRequest => {
  const request = new Request(url) as unknown as NextRequest;

  return Object.assign(request, {
    nextUrl: new URL(url),
    cookies: new Map() as unknown as NextRequest['cookies'],
  });
};

const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;

const run = (path: string) =>
  proxy(buildRequest(`https://common.oneproject.org${path}`), event);

const getNonce = (policy: string | null) =>
  policy?.match(/'nonce-([^']+)'/)?.[1] ?? null;

/**
 * Headers the proxy forwards to the renderer. `NextResponse.next({ request })`
 * encodes them onto the response as `x-middleware-request-*`, and this is the
 * copy Next reads the nonce out of when it renders the scripts.
 */
const getForwardedHeader = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CSP_MODE;
  getClaims.mockResolvedValue({ data: { claims: null } });
});

describe('proxy Content-Security-Policy', () => {
  it('emits an enforcing policy carrying a nonce', async () => {
    const response = await run('/en/decisions');
    const policy = response.headers.get('content-security-policy');

    expect(getNonce(policy)).not.toBeNull();
    expect(policy).toContain("'strict-dynamic'");
    expect(
      response.headers.get('content-security-policy-report-only'),
    ).toBeNull();
  });

  it('forwards the same nonce it enforces, so the render matches', async () => {
    const response = await run('/en/decisions');

    expect(getForwardedHeader(response, 'content-security-policy')).toBe(
      response.headers.get('content-security-policy'),
    );
  });

  it('mints a different nonce per request', async () => {
    const first = await run('/en/decisions');
    const second = await run('/en/decisions');

    expect(getNonce(first.headers.get('content-security-policy'))).not.toBe(
      getNonce(second.headers.get('content-security-policy')),
    );
  });

  it('switches disposition on CSP_MODE without changing the policy', async () => {
    const enforced = (await run('/en/decisions')).headers.get(
      'content-security-policy',
    );

    process.env.CSP_MODE = 'report-only';
    const response = await run('/en/decisions');
    const reported = response.headers.get(
      'content-security-policy-report-only',
    );

    expect(response.headers.get('content-security-policy')).toBeNull();
    // Same directives, different disposition — the rollback lever must not
    // quietly relax the policy it reports on.
    expect(reported?.replace(/'nonce-[^']+'/, '')).toBe(
      enforced?.replace(/'nonce-[^']+'/, ''),
    );
  });

  it.each(['/login', '/Login', '/info/privacy'])(
    'adds no policy on %s, which next.config.mjs already covers',
    async (path) => {
      // Two Content-Security-Policy headers on one response are intersected,
      // and a nonce-free policy intersected with a nonce policy blocks every
      // script on the page. /Login is the case the declared patterns miss:
      // the matcher is case-sensitive, the header source is not.
      const response = await run(path);

      expect(response.headers.get('content-security-policy')).toBeNull();
      expect(
        getForwardedHeader(response, 'content-security-policy'),
      ).toBeNull();
    },
  );

  it('keeps the nonce on the response that a token refresh rebuilds', async () => {
    // GoTrue refreshes an expired token through the cookie adapter, which
    // replaces the response mid-flight. That rebuild previously restored the
    // *original* request headers, dropping x-pathname, x-search and — once the
    // policy moved here — the nonce Next renders with.
    getClaims.mockImplementation(async () => {
      setAllCookies([
        { name: 'sb-access-token', value: 'refreshed', options: {} },
      ]);

      return { data: { claims: { sub: 'user' } } };
    });

    const response = await run('/en/decisions');

    expect(setAllCookies).toHaveBeenCalled();
    expect(getForwardedHeader(response, 'content-security-policy')).toBe(
      response.headers.get('content-security-policy'),
    );
    expect(getForwardedHeader(response, 'x-pathname')).toBe('/en/decisions');
  });
});

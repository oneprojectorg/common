/**
 * The proxy's request-level contract: a refreshed session reaches both the
 * browser and the rest of this request, and a locale-less path is sent to its
 * localized URL without dropping a refreshed token on the way. Matcher tests
 * live in `proxy.test.ts`; the CSP each page gets is in `lib/csp.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClaims = vi.fn();
const setAllCookies = vi.fn();

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
    // Hand the cookie adapter back so a case can drive the token-refresh path.
    setAllCookies.mockImplementation(options.cookies.setAll);

    return { auth: { getClaims } };
  },
}));

const { proxy } = await import('./proxy');

const buildRequest = (
  path: string,
  headers: Record<string, string> = {},
): Request => new Request(`https://common.oneproject.org${path}`, { headers });

const refreshTokenOnClaims = () => {
  getClaims.mockImplementation(async () => {
    setAllCookies([
      { name: 'sb-access-token', value: 'refreshed', options: {} },
    ]);

    return { data: { claims: { sub: 'user' } } };
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: null } });
});

describe('proxy session refresh', () => {
  it('forwards the refreshed token to the rest of the request', async () => {
    refreshTokenOnClaims();
    const request = buildRequest('/en/decisions', {
      cookie: 'sb-access-token=stale; NEXT_LOCALE=en',
    });

    const outcome = await proxy(request);

    // The renderer has to see the new token, not the one the browser sent.
    expect(request.headers.get('cookie')).toContain(
      'sb-access-token=refreshed',
    );
    expect(request.headers.get('cookie')).toContain('NEXT_LOCALE=en');
    expect(outcome).toEqual({
      type: 'continue',
      cookies: [{ name: 'sb-access-token', value: 'refreshed', options: {} }],
    });
  });

  it('sets nothing when the session is current', async () => {
    const request = buildRequest('/en/decisions', {
      cookie: 'sb-access-token=fresh; NEXT_LOCALE=en',
    });

    expect(await proxy(request)).toEqual({ type: 'continue', cookies: [] });
    expect(request.headers.get('cookie')).toBe(
      'sb-access-token=fresh; NEXT_LOCALE=en',
    );
  });
});

describe('proxy locale routing', () => {
  it('learns the locale a visitor browses in', async () => {
    const outcome = await proxy(buildRequest('/es/decisions'));

    expect(outcome.type).toBe('continue');
    expect(outcome.type === 'continue' && outcome.cookies).toEqual([
      expect.objectContaining({ name: 'NEXT_LOCALE', value: 'es' }),
    ]);
  });

  it('keeps the bare root for anonymous visitors', async () => {
    expect((await proxy(buildRequest('/'))).type).toBe('continue');
  });

  it('localizes the bare root for a signed-in visitor', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user' } } });

    const outcome = await proxy(
      buildRequest('/', { 'accept-language': 'fr-FR,fr;q=0.9' }),
    );

    expect(outcome.type).toBe('respond');
    if (outcome.type === 'respond') {
      expect(outcome.response.status).toBe(307);
      expect(outcome.response.headers.get('location')).toBe(
        'https://common.oneproject.org/fr',
      );
    }
  });

  it('prefers the locale cookie over Accept-Language, keeping the query', async () => {
    const outcome = await proxy(
      buildRequest('/columbus?tab=all', {
        cookie: 'NEXT_LOCALE=pt',
        'accept-language': 'fr',
      }),
    );

    expect(
      outcome.type === 'respond' && outcome.response.headers.get('location'),
    ).toBe('https://common.oneproject.org/pt/columbus?tab=all');
  });

  it('carries a refreshed token on the redirect', async () => {
    // Without it the browser retries with the stale refresh token, gets a
    // 400, and loops (most visible on Safari).
    refreshTokenOnClaims();

    const outcome = await proxy(
      buildRequest('/decisions', { cookie: 'sb-access-token=stale' }),
    );

    expect(
      outcome.type === 'respond' &&
        outcome.response.headers.getSetCookie().join('\n'),
    ).toContain('sb-access-token=refreshed');
  });

  it('neutralises a protocol-relative path', async () => {
    const outcome = await proxy(buildRequest('/%5Cevil.example'));

    expect(
      outcome.type === 'respond' &&
        new URL(outcome.response.headers.get('location') ?? '').host,
    ).toBe('common.oneproject.org');
  });
});

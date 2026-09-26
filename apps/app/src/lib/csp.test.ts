import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REPORTING_ENDPOINTS_HEADER,
  buildNonceContentSecurityPolicy,
  buildStaticContentSecurityPolicy,
  createCspNonce,
  getStaticCspHeader,
  isStaticPolicyPath,
} from './csp.mjs';

const parseDirectives = (policy: string) =>
  new Map(
    policy.split('; ').map((directive) => {
      const [name, ...values] = directive.split(' ');

      return [name, values] as const;
    }),
  );

const deployed = { isLocalEnvironment: false };

/**
 * Dropping any of these is an outage, not a policy change: `default-src 'self'`
 * takes over and blanks embeds, blob: previews and every remote avatar.
 */
const REQUIRED_DIRECTIVES = [
  'default-src',
  'base-uri',
  'frame-ancestors',
  'form-action',
  'object-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'connect-src',
  'media-src',
  'worker-src',
  'frame-src',
  'report-uri',
  'report-to',
];

describe('buildNonceContentSecurityPolicy', () => {
  const policy = buildNonceContentSecurityPolicy({
    nonce: 'test-nonce',
    ...deployed,
  });
  const directives = parseDirectives(policy);

  it.each(REQUIRED_DIRECTIVES)('declares %s', (directive) => {
    expect(directives.has(directive)).toBe(true);
  });

  it('carries the nonce and strict-dynamic so injected scripts inherit trust', () => {
    expect(directives.get('script-src')).toEqual(
      expect.arrayContaining(["'nonce-test-nonce'", "'strict-dynamic'"]),
    );
  });

  it("keeps https: and 'unsafe-inline' as pre-CSP3 fallbacks only", () => {
    expect(directives.get('script-src')).toEqual(
      expect.arrayContaining(['https:', "'unsafe-inline'"]),
    );
  });

  it("carries 'unsafe-eval', which ajv forces", () => {
    // Pinned so the cost stays visible; see csp.mjs for why it cannot go.
    expect(directives.get('script-src')).toContain("'unsafe-eval'");
  });

  it('refuses framing and plugin content outright', () => {
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
  });

  it('reports to the group named by the Reporting-Endpoints header', () => {
    const [group] = directives.get('report-to') ?? [];
    const [reportUri] = directives.get('report-uri') ?? [];

    expect(REPORTING_ENDPOINTS_HEADER).toBe(`${group}="${reportUri}"`);
  });
});

describe('buildStaticContentSecurityPolicy', () => {
  const policy = buildStaticContentSecurityPolicy(deployed);
  const directives = parseDirectives(policy);

  it('omits the nonce and strict-dynamic, which prerendered HTML cannot carry', () => {
    expect(policy).not.toContain('nonce-');
    expect(policy).not.toContain("'strict-dynamic'");
  });

  it("falls back to 'unsafe-inline' for the un-nonced bootstrap scripts", () => {
    expect(directives.get('script-src')).toEqual(
      expect.arrayContaining(["'self'", "'unsafe-inline'"]),
    );
  });

  it("does not carry 'unsafe-eval'", () => {
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('shares every non-script directive with the nonce policy', () => {
    const nonceDirectives = parseDirectives(
      buildNonceContentSecurityPolicy({ nonce: 'test-nonce', ...deployed }),
    );

    for (const [name, values] of directives) {
      if (name === 'script-src') {
        continue;
      }

      expect(nonceDirectives.get(name)).toEqual(values);
    }
  });
});

describe('cleartext backends', () => {
  const connectSrc = (
    build: (params: { nonce: string; isLocalEnvironment: boolean }) => string,
    isLocalEnvironment: boolean,
  ) =>
    parseDirectives(build({ nonce: 'test-nonce', isLocalEnvironment })).get(
      'connect-src',
    ) ?? [];

  it.each([
    ['nonce', buildNonceContentSecurityPolicy],
    ['static', buildStaticContentSecurityPolicy],
  ])('the %s policy admits http/ws only locally', (_label, build) => {
    expect(connectSrc(build, false)).not.toContain('http:');
    expect(connectSrc(build, false)).not.toContain('ws:');
    expect(connectSrc(build, true)).toEqual(
      expect.arrayContaining(['http:', 'ws:']),
    );
  });
});

describe('createCspNonce', () => {
  it("matches Next's nonce grammar so the renderer reads it back", () => {
    expect(createCspNonce()).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
  });

  it('returns a fresh value per call', () => {
    expect(createCspNonce()).not.toBe(createCspNonce());
  });
});

describe('isStaticPolicyPath', () => {
  // A false negative gives a response two intersected policies and blocks every
  // script; a false positive leaves it with none.
  it.each([
    '/login',
    '/login/',
    '/login/callback',
    '/info',
    '/info/privacy',
    '/info/tos',
  ])('claims %s', (pathname) => {
    expect(isStaticPolicyPath(pathname)).toBe(true);
  });

  it.each(['/Login', '/LOGIN/callback', '/Info/Privacy'])(
    'claims %s, which next start matches case-insensitively',
    (pathname) => {
      expect(isStaticPolicyPath(pathname)).toBe(true);
    },
  );

  it.each([
    '/',
    '/en',
    '/en/decisions',
    '/logins',
    '/login.html',
    '/information',
    '/en/login',
  ])('declines %s', (pathname) => {
    expect(isStaticPolicyPath(pathname)).toBe(false);
  });
});

describe('the cleartext decision the emitters actually make', () => {
  // The builders take `isLocalEnvironment` as a parameter, so nothing above
  // executes the predicate that decides it in production. Drive it for real.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const admitsCleartext = () =>
    getStaticCspHeader().value.includes('connect-src') &&
    /connect-src[^;]*\bhttp:/.test(getStaticCspHeader().value);

  it.each([
    ['http://127.0.0.1:56321', true],
    ['http://localhost:54321', true],
    ['https://yrpfxbnidfyrzmmsrfic.supabase.co', false],
    ['', false],
    [undefined, false],
  ])('NEXT_PUBLIC_SUPABASE_URL=%s admits http: %s', (url, expected) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);

    expect(admitsCleartext()).toBe(expected);
  });
});

describe('getStaticCspHeader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the enforcing header by default', () => {
    vi.stubEnv('CSP_MODE', undefined);

    expect(getStaticCspHeader().key).toBe('content-security-policy');
  });

  it('names the report-only header under CSP_MODE=report-only', () => {
    // The rollback lever has to reach the static routes too.
    vi.stubEnv('CSP_MODE', 'report-only');

    expect(getStaticCspHeader().key).toBe(
      'content-security-policy-report-only',
    );
  });
});

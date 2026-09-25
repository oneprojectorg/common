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
 * The directives the app ran under before this policy became enforcing. A
 * directive dropped from this list stops being a policy change and starts
 * being an outage: `default-src 'self'` takes over and blanks link-preview
 * iframes, blob: image previews, and every remote avatar.
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
    // A browser that understands 'strict-dynamic' ignores both; one that does
    // not ignores the nonce and needs them. Dropping them locks out the
    // latter, keeping them does not weaken the former.
    expect(directives.get('script-src')).toEqual(
      expect.arrayContaining(['https:', "'unsafe-inline'"]),
    );
  });

  it("carries 'unsafe-eval', which ajv forces", () => {
    // packages/common/src/services/decision/schemaValidator.ts compiles
    // database-authored JSON schemas in the browser with Function(...), and
    // ajv throws rather than degrading. Dropping this blanks every proposal,
    // review and process-builder form. Pinned so the cost stays visible.
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
    // These routes are built once, with no request to mint a nonce from.
    // 'strict-dynamic' here would block every script on the page.
    expect(policy).not.toContain('nonce-');
    expect(policy).not.toContain("'strict-dynamic'");
  });

  it("falls back to 'unsafe-inline' for the un-nonced bootstrap scripts", () => {
    expect(directives.get('script-src')).toEqual(
      expect.arrayContaining(["'self'", "'unsafe-inline'"]),
    );
  });

  it("does not carry 'unsafe-eval'", () => {
    // The login screen and the static legal pages never reach the
    // decision-schema validator that forces it on the nonce policy.
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
  // The dev server and the e2e stack reach the tRPC API over http://localhost
  // and Supabase realtime over ws://127.0.0.1. A deployed environment must
  // not, or the policy leaves a cleartext exfiltration channel open.
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
    // Mirrors the regex in next/dist/server/app-render/get-script-nonce-from-header.
    expect(createCspNonce()).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
  });

  it('returns a fresh value per call', () => {
    expect(createCspNonce()).not.toBe(createCspNonce());
  });
});

describe('isStaticPolicyPath', () => {
  // The proxy asks this before adding its own policy. A false negative gives a
  // response two intersected policies and blocks every script on the page; a
  // false positive leaves it with none.
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
  // The builders above take `isLocalEnvironment` as a parameter, so none of
  // them executes the predicate that decides it in production. That predicate
  // has been wrong twice: `!VERCEL_ENV` read any non-Vercel build as local and
  // shipped `http:` to production, and `NODE_ENV` disagreed between the two
  // emitters. Drive it through the real entry point.
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
    // The rollback lever has to reach the static routes too: when this was
    // hardcoded, report-only silenced the proxy policy while /login and
    // /info kept enforcing.
    vi.stubEnv('CSP_MODE', 'report-only');

    expect(getStaticCspHeader().key).toBe(
      'content-security-policy-report-only',
    );
  });
});

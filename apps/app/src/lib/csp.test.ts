import { describe, expect, it } from 'vitest';

import {
  REPORTING_ENDPOINTS_HEADER,
  buildNonceContentSecurityPolicy,
  buildStaticContentSecurityPolicy,
  createCspNonce,
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

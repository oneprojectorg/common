import { describe, expect, it } from 'vitest';

import { getSafeRedirectPath, isSafeRedirectPath } from './client';

describe('isSafeRedirectPath', () => {
  describe('accepts paths under a known app route prefix', () => {
    it.each([
      '/en/decisions/abc',
      '/es/profile/orpdm',
      '/fr/dashboard',
      '/pt/foo/bar/baz',
      '/bn/something',
      '/so/page',
      '/ar/page',
      '/privacy',
      '/tos',
      '/en',
      '/privacy?foo=1',
      '/en/decisions/abc?tab=votes',
      '/en/decisions/abc#section',
    ])('accepts %s', (path) => {
      expect(isSafeRedirectPath(path)).toBe(true);
    });
  });

  describe('rejects paths outside the whitelist', () => {
    it.each([
      ['/', 'bare root'],
      ['/dashboard', 'no locale prefix'],
      ['/foo/bar', 'unknown top-level segment'],
      ['/login', 'login page'],
      ['/en/login', 'locale-prefixed login page'],
      ['/es/login', 'locale-prefixed login page'],
      ['/en/login?redirect=%2Fen', 'locale-prefixed login with query'],
      ['/api/auth/callback', '/api/*'],
      ['/api/anything', '/api/*'],
      ['/en2/foo', 'similar-looking but invalid locale'],
      ['/english/foo', 'invalid locale'],
      ['/tosfoo', 'tos-prefix without boundary'],
      ['/privacyfoo', 'privacy-prefix without boundary'],
    ])('rejects %j (%s)', (path) => {
      expect(isSafeRedirectPath(path)).toBe(false);
    });
  });

  describe('rejects open-redirect bypass vectors', () => {
    // These all resolve to a foreign origin in the WHATWG URL parser (and
    // therefore in window.location.href / NextResponse.redirect) even though
    // they pass a naive `startsWith('/') && !startsWith('//')` check.
    // Whitelist matching rejects them because none start with a known prefix.
    it.each([
      ['//evil.com', 'protocol-relative URL'],
      ['/\\evil.com', 'backslash after leading slash'],
      ['/\\\\evil.com', 'double backslash'],
      ['/\t//evil.com', 'tab + protocol-relative'],
      ['/\r//evil.com', 'CR + protocol-relative'],
      ['/\n//evil.com', 'LF + protocol-relative'],
      ['/\x00evil', 'null byte'],
      ['/foo\\evil.com', 'backslash mid-path'],
    ])('rejects %j (%s)', (path) => {
      expect(isSafeRedirectPath(path)).toBe(false);
    });
  });

  describe('rejects non-path inputs', () => {
    it.each([
      null,
      '',
      'https://evil.com',
      'evil.com',
      'javascript:alert(1)',
      'mailto:a@b.com',
      ' /foo',
    ])('rejects %j', (path) => {
      expect(isSafeRedirectPath(path)).toBe(false);
    });
  });
});

describe('getSafeRedirectPath', () => {
  describe('returns the path unchanged when already decoded', () => {
    it.each(['/en/profile/orpdm', '/fr/dashboard', '/privacy'])(
      '%s',
      (path) => {
        expect(getSafeRedirectPath(path)).toBe(path);
      },
    );
  });

  describe('decodes percent-encoded paths back to their canonical form', () => {
    // Real-world: the proxy redirects unauthed users to
    // /login?redirect=%2Fen%2Fprofile%2Forpdm. Code paths that read the value
    // without going through URL-decoding (e.g. parsed off request.url manually)
    // still need to return the user to the original page after login.
    it.each([
      ['%2Fen%2Fprofile%2Forpdm', '/en/profile/orpdm'],
      ['%2Fes%2Fdashboard', '/es/dashboard'],
      ['%2Fprivacy', '/privacy'],
      ['%2Fen%2Fdecisions%2Fabc%3Ftab%3Dvotes', '/en/decisions/abc?tab=votes'],
    ])('%s -> %s', (input, expected) => {
      expect(getSafeRedirectPath(input)).toBe(expected);
    });
  });

  describe('rejects percent-encoded paths outside the whitelist', () => {
    it.each([
      ['%2F%2Fevil.com', 'encoded //evil.com'],
      ['%2F%5Cevil.com', 'encoded /\\evil.com'],
      ['%5Cevil.com', 'encoded \\evil.com'],
      ['%2F%00evil', 'encoded null byte'],
      ['%2Fapi%2Ffoo', 'encoded /api/foo'],
      ['%2Flogin', 'encoded /login'],
      ['%2Fen%2Flogin', 'encoded locale-prefixed /en/login'],
      ['%252F%252Fen%252Fprofile', 'double-encoded /en/profile'],
      ['%', 'malformed escape'],
      ['%2', 'truncated escape'],
    ])('rejects %j (%s)', (input) => {
      expect(getSafeRedirectPath(input)).toBeNull();
    });
  });

  it('returns null for null input', () => {
    expect(getSafeRedirectPath(null)).toBeNull();
  });
});

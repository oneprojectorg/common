/**
 * Tests for the paths the proxy runs on.
 *
 * Every path it catches triggers `auth.getClaims()` in the proxy, adding a
 * GoTrue round-trip per page nav. The exclusion list must stay broad enough
 * to skip routes that have no Supabase-cookie or locale-redirect dependency.
 */
import { describe, expect, it } from 'vitest';

import { isProxiedPath } from './proxy';

const matches = (path: string) => isProxiedPath(path);

describe('proxy matcher', () => {
  describe('walled-garden routes (must still match)', () => {
    const PROTECTED = [
      '/',
      '/en',
      '/en/',
      '/en/decisions',
      '/en/decisions/some-slug',
      '/en/profile/scott',
      '/en/admin/orgs',
      '/en/start',
      '/en/org/acme',
      '/protected/anything',
      '/protected/nested/path',
    ];
    it.each(PROTECTED)('matches %s', (path) => {
      expect(matches(path)).toBe(true);
    });
  });

  describe('skipped path prefixes (must NOT match)', () => {
    const SKIPPED = [
      '/_build/assets/main.js',
      '/_serverFn/abc123',
      '/api/v1/trpc/account.getMyAccount',
      '/api/auth/callback',
      '/api/waitlist-signup',
      '/assets/uploads/avatar.png',
      '/stats/decide',
      '/stats/static/array.js',
      '/waitlist',
      '/info/privacy',
      '/info/tos',
      '/login',
      '/favicon.ico',
      '/sitemap.xml',
      '/robots.txt',
      '/manifest.webmanifest',
      '/health',
      '/_health',
    ];
    it.each(SKIPPED)('skips %s', (path) => {
      expect(matches(path)).toBe(false);
    });
  });

  // These are served the static, nonce-free policy and sit outside `/$locale`,
  // so the locale redirect would send them to pages that don't exist.
  describe('routes served the static CSP (must NOT match)', () => {
    it.each(['/login', '/login/nested', '/info', '/info/nested'])(
      'skips %s',
      (path) => {
        expect(matches(path)).toBe(false);
      },
    );
  });

  describe('skipped static asset extensions (must NOT match)', () => {
    const STATIC_ASSETS = [
      // images
      '/logo-common.svg',
      '/op.png',
      '/photo.jpg',
      '/LinkPreview.jpeg',
      '/animation.gif',
      '/hero.webp',
      '/poster.avif',
      '/icon.ico',
      '/diagram.bmp',
      // fonts
      '/fonts/Roboto.woff',
      '/fonts/Roboto.woff2',
      '/fonts/Roboto.ttf',
      '/fonts/Roboto.otf',
      '/fonts/Roboto.eot',
      // documents
      '/policy.pdf',
      // structured data + text
      '/manifest.json',
      '/feed.xml',
      '/notes.txt',
      // static html dropped in public/ (e.g. domain-verification tokens,
      // which the issuer fetches anonymously and must receive verbatim —
      // a locale redirect fails the check)
      '/a05c2b9e2ee552f2a38181aa7c510bdd.html',
      // build assets
      '/styles.css',
      '/bundle.js',
      '/bundle.js.map',
      // media
      '/intro.mp4',
      '/clip.webm',
      '/jingle.mp3',
      '/loop.ogg',
      '/sample.wav',
      // nested paths still pick up the extension
      '/some/deep/path/asset.svg',
      '/_build/assets/app.css',
    ];
    it.each(STATIC_ASSETS)('skips %s', (path) => {
      expect(matches(path)).toBe(false);
    });
  });
});

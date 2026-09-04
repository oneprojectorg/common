/**
 * Tests for the proxy middleware matcher.
 *
 * Every path the matcher catches triggers `auth.getUser()` in the proxy,
 * doubling the GoTrue round-trip per page nav (middleware + tRPC). The
 * exclusion list must stay broad enough to skip routes that have no
 * Supabase-cookie or locale-redirect dependency.
 *
 * The matcher pattern lives inline in `proxy.ts` because Next's static
 * analyzer requires it to be a plain string literal (cross-file imports
 * fail with `Unknown identifier ... at config.matcher[0]`). To stay
 * single-source, this test reads the literal straight out of `proxy.ts`
 * rather than maintaining a separate copy.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

const proxySource = readFileSync(resolve(__dirname, 'proxy.ts'), 'utf8');
const [, sourceLiteral] = proxySource.match(/matcher:\s*\[\s*'([^']+)'/) ?? [];
if (!sourceLiteral) {
  throw new Error(
    'Could not extract matcher literal from proxy.ts — has the `config.matcher` shape changed?',
  );
}
// Source-form `\\.` represents a single `\.` in the runtime string.
const PROXY_MATCHER_PATTERN = sourceLiteral.replace(/\\\\/g, '\\');

const matcherRegex = new RegExp(`^${PROXY_MATCHER_PATTERN}$`);

const matches = (path: string) => matcherRegex.test(path);

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
      '/_next/static/chunks/main.js',
      '/_next/image?url=foo',
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
      '/_next/static/css/app.css',
    ];
    it.each(STATIC_ASSETS)('skips %s', (path) => {
      expect(matches(path)).toBe(false);
    });
  });
});

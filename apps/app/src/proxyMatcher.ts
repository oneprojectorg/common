/**
 * Path patterns the proxy middleware skips. Every page-nav match in
 * `proxy.ts` doubles the GoTrue round-trip cost (middleware + tRPC each
 * call `auth.getUser()`), so this list is kept as broad as is safe —
 * anything the user hits that does not need Supabase cookie refresh or
 * i18n-locale redirect belongs here.
 *
 * Kept in a no-dependency file so it can be unit-tested without pulling in
 * the Next.js / Supabase runtime — `proxy.ts` re-exports the compiled
 * pattern.
 *
 * Categories (kept grouped for review):
 *   - Next internals:         `_next/static`, `_next/image`
 *   - In-tree API + rewrites: `api`, `assets`, `stats`
 *   - Public landing pages:   `waitlist`, `info`, `login`
 *   - SEO/monitoring files:   `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `health`, `_health`
 *   - Static asset extensions (favicon, fonts, images, audio/video, JSON, txt, xml, source maps, etc.)
 */
const SKIPPED_PATH_PREFIXES = [
  '_next/static',
  '_next/image',
  'api',
  'assets',
  'stats',
  'waitlist',
  'info',
  'login',
  'sitemap.xml',
  'robots.txt',
  'manifest.webmanifest',
  'favicon.ico',
  'health',
  '_health',
].join('|');

const SKIPPED_FILE_EXTENSIONS = [
  // images
  'svg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'ico',
  'bmp',
  // fonts
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  // documents
  'pdf',
  // structured data + text
  'json',
  'xml',
  'txt',
  // build assets
  'css',
  'js',
  'map',
  // media
  'mp4',
  'webm',
  'mp3',
  'ogg',
  'wav',
].join('|');

export const PROXY_MATCHER_PATTERN = `/((?!${SKIPPED_PATH_PREFIXES}|.*\\.(?:${SKIPPED_FILE_EXTENSIONS})$).*)`;

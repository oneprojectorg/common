/**
 * The proxy middleware matcher pattern, kept here as a plain string literal
 * so it can be unit-tested without pulling in the Next.js / Supabase /
 * next-intl runtime (importing from `proxy.ts` fails Vitest resolution).
 *
 * Next.js statically analyzes `config.matcher` in `proxy.ts` and cannot
 * follow cross-file imports (fails with `Unknown identifier ... at
 * config.matcher[0]`), so the same literal is also inlined in `proxy.ts`.
 * The two MUST stay in sync — `proxy.test.ts` exercises the regex behavior
 * via this constant.
 *
 * Skipped path prefixes (no-auth routes):
 *   - Next internals:         `_next/static`, `_next/image`
 *   - In-tree API + rewrites: `api`, `assets`, `stats`
 *   - Public landing pages:   `waitlist`, `info`, `login`
 *   - SEO/monitoring files:   `sitemap.xml`, `robots.txt`,
 *                              `manifest.webmanifest`, `health`, `_health`,
 *                              `favicon.ico`
 *
 * Skipped file extensions (all asset traffic, including S3 rewrites):
 *   - images: svg, png, jpg, jpeg, gif, webp, avif, ico, bmp
 *   - fonts:  woff, woff2, ttf, otf, eot
 *   - docs:   pdf
 *   - text:   json, xml, txt
 *   - build:  css, js, map
 *   - media:  mp4, webm, mp3, ogg, wav
 */
export const PROXY_MATCHER_PATTERN =
  '/((?!_next/static|_next/image|api|assets|stats|waitlist|info|login|sitemap.xml|robots.txt|manifest.webmanifest|favicon.ico|health|_health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf|eot|pdf|json|xml|txt|css|js|map|mp4|webm|mp3|ogg|wav)$).*)';

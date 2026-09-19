// Decision-process slugs exposed at the vanity URL `/[locale]/<slug>`, which
// `next.config.mjs` rewrites to the real `/[locale]/decisions/<slug>` route.
// Lives beside `next.config.mjs` (not under `src/`) because build config cannot
// read TS, and in its own module so the parsing rules below are unit-testable —
// `next.config.mjs` itself is not.
//
// The list is deliberately an allowlist rather than a catch-all: the rewrite is
// an `afterFiles` rule, which Next applies BEFORE dynamic routes, so an
// unbounded `/:locale/:slug` would shadow `/[locale]/profile/[slug]` and every
// other dynamic route under the locale segment.
//
// Set `VANITY_DECISION_SLUGS` (comma-separated) to put another public process
// on its vanity path. Unset keeps today's behaviour.

/** Fallback when `VANITY_DECISION_SLUGS` is unset. */
export const DEFAULT_VANITY_DECISION_SLUGS = ['columbus'];

// Real route segments under `/[locale]`, plus the two top-level pages that sit
// outside it (`/login`, `/info`). A vanity slug matching one of these would be
// rewritten into the decision route ahead of the page that owns it.
//
// Mirrors the route tree, so it can drift when a route is added. The test
// walks `src/app` and fails when a new segment is missing from this list.
export const ROUTE_SEGMENTS = [
  'admin',
  'decisions',
  'info',
  'login',
  'org',
  'profile',
  'search',
  'start',
];

// Prefixes `proxy.ts` excludes from its matcher. The proxy is what adds the
// locale to a bare `/<slug>`, so a vanity slug named after one of these gets a
// working `/en/<slug>` and a silently broken `/<slug>` — the shareable half of
// the vanity URL is the half that breaks. The rest of the exclusion list
// (`_next/*`, `sitemap.xml`, ...) carries `_` or `.` and `SLUG_PATTERN` already
// rejects it.
export const PROXY_SKIPPED_SEGMENTS = [
  'api',
  'assets',
  'health',
  'stats',
  'waitlist',
];

// Profile slugs come from `generateUniqueProfileSlug` in @op/common, which runs
// `slugify` in lowercase strict mode and may append a `-2` uniqueness suffix:
// lowercase alphanumerics in hyphen-separated groups. Build config cannot
// import that TS helper, so the shape is restated here.
//
// Anything else is rejected rather than escaped — the value is interpolated raw
// into a path-to-regexp `source`, so a stray `|`, `(`, or `/` would silently
// widen the rewrite instead of failing.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Parse the `VANITY_DECISION_SLUGS` env value into a normalized slug list.
 *
 * Returns the default list when the variable is unset, and an empty list when
 * it is set but names nothing (`''`, `','`) — that is how an environment opts
 * out of vanity URLs entirely.
 *
 * @param {string | undefined} rawValue
 * @returns {string[]}
 */
export function parseVanityDecisionSlugs(rawValue) {
  if (rawValue === undefined) {
    return [...DEFAULT_VANITY_DECISION_SLUGS];
  }

  const entries = rawValue
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    if (!SLUG_PATTERN.test(entry)) {
      throw new Error(
        `VANITY_DECISION_SLUGS contains "${entry}", which is not a valid decision slug. Use lowercase letters, digits, and single hyphens.`,
      );
    }
    if (ROUTE_SEGMENTS.includes(entry)) {
      throw new Error(
        `VANITY_DECISION_SLUGS contains "${entry}", which is an existing app route. A vanity rewrite for it would shadow /[locale]/${entry}.`,
      );
    }
    if (PROXY_SKIPPED_SEGMENTS.includes(entry)) {
      throw new Error(
        `VANITY_DECISION_SLUGS contains "${entry}", which proxy.ts excludes from its matcher. /${entry} would never pick up a locale, so only /<locale>/${entry} would resolve.`,
      );
    }
  }

  return [...new Set(entries)];
}

/**
 * Build the vanity rewrite rule, or `null` when no slug is exposed — an empty
 * slug list would otherwise produce `/:slug()`, an empty capture group that
 * matches paths no page owns.
 *
 * @param {{ locales: readonly string[], slugs: readonly string[] }} params
 * @returns {{ source: string, destination: string } | null}
 */
export function buildVanityDecisionRewrite({ locales, slugs }) {
  if (slugs.length === 0) {
    return null;
  }

  return {
    source: `/:locale(${locales.join('|')})/:slug(${slugs.join('|')})/:path*`,
    destination: '/:locale/decisions/:slug/:path*',
  };
}

/**
 * The vanity rewrite is an `afterFiles` rule, so Next applies it before every
 * dynamic route under `/[locale]`. A slug list that is too wide — or a value
 * carrying regex syntax — silently reroutes real pages into the decision view,
 * which is why parsing is strict and tested here rather than inlined in
 * `next.config.mjs` (build config runs too early to assert against).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VANITY_DECISION_SLUGS,
  PROXY_SKIPPED_SEGMENTS,
  ROUTE_SEGMENTS,
  buildVanityDecisionRewrite,
  parseVanityDecisionSlugs,
} from './vanityDecisionSlugs.mjs';

describe('parseVanityDecisionSlugs', () => {
  it('falls back to the default list when the variable is unset', () => {
    expect(parseVanityDecisionSlugs(undefined)).toEqual(['columbus']);
  });

  it('returns a copy, so a caller cannot mutate the shared default', () => {
    const parsed = parseVanityDecisionSlugs(undefined);
    parsed.push('tampered');

    expect(DEFAULT_VANITY_DECISION_SLUGS).toEqual(['columbus']);
  });

  it('reads a single slug from the variable, replacing the default', () => {
    expect(parseVanityDecisionSlugs('participatory-budget')).toEqual([
      'participatory-budget',
    ]);
  });

  it('reads several slugs, trimming and lowercasing each', () => {
    expect(
      parseVanityDecisionSlugs(' Columbus , participatory-budget '),
    ).toEqual(['columbus', 'participatory-budget']);
  });

  it('drops duplicates so the rewrite alternation stays minimal', () => {
    expect(parseVanityDecisionSlugs('columbus,Columbus,columbus')).toEqual([
      'columbus',
    ]);
  });

  it.each(['', ',', ' , '])(
    'treats %o as opting out of vanity URLs entirely',
    (rawValue) => {
      expect(parseVanityDecisionSlugs(rawValue)).toEqual([]);
    },
  );

  // Each of these would widen the generated `source` beyond the intended slug
  // rather than fail, so the parse has to reject them outright.
  it.each([
    ['a regex alternation', 'columbus|profile'],
    ['a regex group', '(columbus)'],
    ['a wildcard', '.*'],
    ['a path separator', 'columbus/current'],
    ['an uppercase-only slug that is not a slug', 'Columbus Process'],
    ['a leading hyphen', '-columbus'],
    ['a trailing hyphen', 'columbus-'],
    ['a double hyphen', 'colum--bus'],
  ])('rejects %s', (_label, rawValue) => {
    expect(() => parseVanityDecisionSlugs(rawValue)).toThrow(
      /not a valid decision slug/,
    );
  });

  it.each([
    'admin',
    'decisions',
    'info',
    'login',
    'org',
    'profile',
    'search',
    'start',
  ])('rejects %o because the rewrite would shadow that route', (segment) => {
    expect(() => parseVanityDecisionSlugs(segment)).toThrow(
      /existing app route/,
    );
  });

  // These resolve at `/en/<slug>` but not at the bare `/<slug>` the vanity URL
  // exists to provide, because the proxy never sees the request to add a locale.
  it.each(['api', 'assets', 'health', 'stats', 'waitlist'])(
    'rejects %o because the proxy skips it and the bare path would not resolve',
    (segment) => {
      expect(() => parseVanityDecisionSlugs(segment)).toThrow(
        /excludes from its matcher/,
      );
    },
  );
});

describe('buildVanityDecisionRewrite', () => {
  it('builds a locale- and slug-constrained rewrite into the decision route', () => {
    expect(
      buildVanityDecisionRewrite({
        locales: ['en', 'es'],
        slugs: ['columbus'],
      }),
    ).toEqual({
      source: '/:locale(en|es)/:slug(columbus)/:path*',
      destination: '/:locale/decisions/:slug/:path*',
    });
  });

  it('alternates every allow-listed slug', () => {
    expect(
      buildVanityDecisionRewrite({
        locales: ['en'],
        slugs: ['columbus', 'participatory-budget'],
      })?.source,
    ).toBe('/:locale(en)/:slug(columbus|participatory-budget)/:path*');
  });

  // `/:slug()` is an empty capture group, not a rule that matches nothing.
  it('emits no rule for an empty slug list', () => {
    expect(
      buildVanityDecisionRewrite({ locales: ['en'], slugs: [] }),
    ).toBeNull();
  });
});

/**
 * Both reserved lists restate something they don't own — the route tree and the
 * proxy matcher — so either can go stale, and a stale entry stays invisible
 * until someone points `VANITY_DECISION_SLUGS` at the name it missed. Read both
 * sources off disk instead of trusting the lists. Each list is checked against
 * its own source, not the union, so one can't cover for the other.
 */
describe('reserved segments', () => {
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), 'src/app');

  /**
   * Route segments a URL can actually address, one level deep. Parenthesised
   * names are route groups, which add no segment, so their children are the
   * addressable ones; bracketed names are dynamic params, not literals.
   */
  const routeSegments = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        entry.name.startsWith('(')
          ? routeSegments(resolve(dir, entry.name))
          : [entry.name],
      )
      .filter((name) => !name.startsWith('[') && !name.startsWith('_'));

  it.each(['[locale]', ''])(
    'covers every addressable segment under src/app/%s',
    (base) => {
      // `api` sits under `src/app` but owns no `/[locale]` page, so nothing
      // there can be shadowed. It is reserved for the other reason instead.
      const segments = routeSegments(resolve(appDir, base)).filter(
        (segment) => !PROXY_SKIPPED_SEGMENTS.includes(segment),
      );

      expect(segments.length).toBeGreaterThan(0);
      expect(ROUTE_SEGMENTS).toEqual(expect.arrayContaining(segments));
    },
  );

  // Same drift problem from the other side: `proxy.ts` owns the exclusion list,
  // and adding a slug-shaped prefix there silently breaks a vanity URL named
  // after it. Read the literal out of the source, as `proxy.test.ts` does.
  it('covers every slug-shaped prefix the proxy matcher excludes', () => {
    const proxySource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'src/proxy.ts'),
      'utf8',
    );
    const [, matcher] = proxySource.match(/matcher:\s*\[\s*'([^']+)'/) ?? [];
    if (!matcher) {
      throw new Error(
        'Could not extract the matcher literal from proxy.ts — has `config.matcher` changed shape?',
      );
    }

    // Take the path-prefix alternatives only, stopping before the trailing
    // `.*\.(?:svg|png|...)$` extension group — its alternatives are file
    // extensions, not path prefixes, and would otherwise read as slugs.
    const [, prefixes] = matcher.match(/\(\?!(.*?)\|\.\*/) ?? [];
    if (prefixes === undefined) {
      throw new Error(
        'Could not split the proxy matcher into path prefixes — has the exclusion list changed shape?',
      );
    }

    // Only bare single-segment prefixes can collide with a slug: anything with
    // a `/`, `.`, or `_` is already unreachable through `SLUG_PATTERN`.
    const slugShaped = prefixes
      .split('|')
      .filter((prefix) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prefix));

    // Against the union: `info` and `login` are real routes that the proxy also
    // skips, and being reserved as a route already closes the hole.
    expect(slugShaped.length).toBeGreaterThan(0);
    expect([...ROUTE_SEGMENTS, ...PROXY_SKIPPED_SEGMENTS]).toEqual(
      expect.arrayContaining(slugShaped),
    );
  });
});

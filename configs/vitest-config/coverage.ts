import type { ViteUserConfig } from 'vitest/config';

type TestConfig = NonNullable<ViteUserConfig['test']>;
type CoverageConfig = NonNullable<TestConfig['coverage']>;

/**
 * Files that are never interesting to CRAP: build output, or sources that hold no
 * branching logic of their own, or that exist only to exercise the code that does.
 */
const SHARED_EXCLUDES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/*.test.{ts,tsx}',
  '**/*.spec.{ts,tsx}',
  '**/*.stories.{ts,tsx}',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/__fixtures__/**',
  '**/test/**',
  '**/*.config.{ts,mts,mjs}',
];

/** Where a workspace keeps its own sources, unless it says otherwise. */
const OWN_SOURCES = ['src/**/*.{ts,tsx}'];

/**
 * Sources belonging to *other* workspaces, matched relative to this one — a
 * loaded `@op/common` module relativizes to `../../packages/common/src/…`, so
 * only a pattern with a leading `**` segment can match it. A pattern rooted at
 * the workspace, as `include` normally is, never will.
 *
 * Appended to every workspace's `include` so a test is credited with everything
 * it runs, not just the part that happens to live in its own package. See
 * `allowExternal` below.
 *
 * The pattern names our workspace roots rather than matching a `src` directory
 * anywhere, because dependencies ship TypeScript under `src` too. Instrumenting
 * one of those drags it out of Node's resolver and into vite's, where its own
 * deep imports stop resolving — react-email reaching into `tailwindcss/lib` is
 * the one that bites.
 *
 * Pointing outward explicitly, with a pattern that starts `../..`, does not work
 * either: the scan for never-loaded files walks it as a glob root and vitest
 * dies with `Unhandled Error: Unknown Error: undefined`. This pattern stays
 * inside the workspace during that scan and only widens the filter for files a
 * test actually loaded.
 */
const CROSS_WORKSPACE_SOURCES = [
  '**/{apps,packages,services}/*/src/**/*.{ts,tsx}',
];

/**
 * Shared vitest coverage settings for every workspace in the monorepo.
 *
 * `fallow health` computes per-function CRAP (Change Risk Anti-Patterns) from an
 * Istanbul `coverage-final.json`. Without one it falls back to a static binary
 * model — a function counts as covered when *any* import path reaches its file
 * from a test root — which collapses CRAP into a rescaled complexity score.
 *
 * @param overrides merged over the defaults. `include` names this workspace's own
 * sources (pass it for a workspace whose sources do not live under `src/`) and is
 * extended with the cross-workspace patterns rather than replacing them; `exclude`
 * is appended to {@link SHARED_EXCLUDES}.
 */
export const coverageConfig = (
  overrides: Partial<CoverageConfig> = {},
): CoverageConfig => {
  const { include = OWN_SOURCES, exclude = [], ...rest } = overrides;

  return {
    // Fallow requires Istanbul-format output. The v8 provider's remapped report
    // loses per-function fidelity on transpiled TS, which is exactly the axis CRAP
    // scores on.
    provider: 'istanbul',
    // `--coverage` on the CLI turns this on, so a plain `pnpm test` stays fast and
    // uninstrumented.
    enabled: false,
    // Instrument modules resolved outside this workspace. Our tests are mostly
    // integration tests — `services/api` drives real tRPC procedures against a
    // real database, and the logic they exercise lives in `@op/common`. Left off
    // (the default), instrumentation stops at the workspace boundary: every line
    // of `@op/common` those tests run is invisible, so the layer holding the
    // business logic reads as untested and its CRAP is scored as if it were.
    // Reports overlap once this is on, which is what `scripts/merge-coverage.mjs`
    // sums.
    allowExternal: true,
    // `json` is the reporter that writes coverage-final.json; text-summary keeps
    // the terminal useful without generating an HTML tree nobody opens in CI.
    reporter: ['json', 'text-summary'],
    reportsDirectory: './coverage',
    // Vitest reports only files a test actually loaded unless `include` is set.
    // Untested files have to show up at zero coverage or CRAP silently skips the
    // very code most at risk — an untested 40-branch function would simply be
    // absent from the report rather than scoring ~1640. That zero-fill scan is
    // per workspace, so each one still contributes its own untouched files while
    // the cross-workspace patterns pick up whatever the tests reached.
    include: [...new Set([...include, ...CROSS_WORKSPACE_SOURCES])],
    exclude: [...SHARED_EXCLUDES, ...exclude],
    ...rest,
  };
};

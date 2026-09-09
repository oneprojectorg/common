import type { ViteUserConfig } from 'vitest/config';

type TestConfig = NonNullable<ViteUserConfig['test']>;
type CoverageConfig = NonNullable<TestConfig['coverage']>;

/**
 * Files that are never interesting to CRAP: they hold no branching logic of their
 * own, or they exist only to exercise the code that does.
 */
const SHARED_EXCLUDES = [
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

/**
 * Shared vitest coverage settings for every workspace in the monorepo.
 *
 * `fallow health` computes per-function CRAP (Change Risk Anti-Patterns) from an
 * Istanbul `coverage-final.json`. Without one it falls back to a static binary
 * model — a function counts as covered when *any* import path reaches its file
 * from a test root — which collapses CRAP into a rescaled complexity score.
 *
 * @param overrides merged over the defaults; pass `include` for a workspace whose
 * sources do not live under `src/`.
 */
export const coverageConfig = (
  overrides: Partial<CoverageConfig> = {},
): CoverageConfig => ({
  // Fallow requires Istanbul-format output. The v8 provider's remapped report
  // loses per-function fidelity on transpiled TS, which is exactly the axis CRAP
  // scores on.
  provider: 'istanbul',
  // `--coverage` on the CLI turns this on, so a plain `pnpm test` stays fast and
  // uninstrumented.
  enabled: false,
  // `json` is the reporter that writes coverage-final.json; text-summary keeps
  // the terminal useful without generating an HTML tree nobody opens in CI.
  reporter: ['json', 'text-summary'],
  reportsDirectory: './coverage',
  // Vitest reports only files a test actually loaded unless `include` is set.
  // Untested files have to show up at zero coverage or CRAP silently skips the
  // very code most at risk — an untested 40-branch function would simply be
  // absent from the report rather than scoring ~1640.
  include: ['src/**/*.{ts,tsx}'],
  exclude: SHARED_EXCLUDES,
  ...overrides,
});

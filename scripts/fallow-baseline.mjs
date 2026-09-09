#!/usr/bin/env node
/**
 * Save or compare the committed `fallow health` baseline.
 *
 *   node scripts/fallow-baseline.mjs           # rewrite the committed baseline
 *   node scripts/fallow-baseline.mjs --trend   # diff today against it
 *
 * Two artefacts, because fallow keeps two kinds of baseline:
 *
 *   health-baseline.json  complexity findings, consumed by `--baseline` so
 *                         `pnpm health` reports only functions that got worse
 *   health-snapshot.json  vital signs — including the CRAP columns — consumed
 *                         by `--trend`
 *
 * Plus one of ours, because fallow aggregates CRAP nowhere:
 *
 *   crap-trend.json       scope-wide CRAP aggregates, so `pnpm health` can show
 *                         a delta. Aggregates only: `pnpm health` gates on the
 *                         files a change touched, which needs no committed
 *                         per-file record, and a committed per-file record has
 *                         to be rewritten from a full instrumented run every
 *                         time anyone improves anything.
 *
 * `--trend` only ever reads `.fallow/snapshots/`, which is gitignored working
 * state, so the committed snapshot is staged into that directory first. Local
 * ad-hoc snapshots are cleared on the way through: the point of `--trend` here
 * is the delta against the shared baseline, not against whatever this machine
 * last measured.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectCrap, writeCrapTrend } from './lib/fallow-crap.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COVERAGE = join(ROOT, 'coverage', 'coverage-final.json');
const BASELINE = join(ROOT, 'configs', 'fallow', 'health-baseline.json');
const SNAPSHOT = join(ROOT, 'configs', 'fallow', 'health-snapshot.json');
const SNAPSHOT_DIR = join(ROOT, '.fallow', 'snapshots');

/**
 * Every workspace that runs vitest. A baseline built while one of them was
 * skipped is worse than no baseline: its files fall back to fallow's static
 * estimate, and the next full run reads as a huge phantom improvement when they
 * pick up real coverage.
 */
const INSTRUMENTED_WORKSPACES = [
  'apps/app',
  'packages/common',
  'services/api',
  'services/cache',
  'services/collab',
  'services/emails',
  'services/realtime',
];

const trend = process.argv.includes('--trend');

if (!existsSync(COVERAGE)) {
  console.error(
    `No merged coverage at ${COVERAGE}.\n` +
      'Run `pnpm test:coverage` first — without it fallow falls back to its static\n' +
      'binary coverage model and the CRAP numbers are not comparable to the baseline.',
  );
  process.exit(1);
}

const assertCompleteCoverage = () => {
  const covered = new Set(
    Object.keys(JSON.parse(readFileSync(COVERAGE, 'utf8'))).map((file) =>
      file.startsWith(ROOT) ? file.slice(ROOT.length + 1) : file,
    ),
  );
  const missing = INSTRUMENTED_WORKSPACES.filter(
    (workspace) =>
      !covered.values().some((file) => file.startsWith(`${workspace}/`)),
  );
  if (missing.length > 0) {
    console.error(
      `The merged coverage report has nothing from:\n` +
        missing.map((workspace) => `  ${workspace}`).join('\n') +
        `\n\nRun the full \`pnpm test:coverage\` before baselining. services/api needs a\n` +
        `local Supabase (\`supabase start && pnpm w:db migrate:test\`); without it those\n` +
        `files silently fall back to the static coverage estimate.`,
    );
    process.exit(1);
  }
};

const fallow = (args) => {
  const result = spawnSync('fallow', args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) {
    console.error(`Could not run fallow: ${result.error.message}`);
    process.exit(1);
  }
  return result.status ?? 0;
};

if (trend) {
  if (!existsSync(SNAPSHOT)) {
    console.error(
      `No committed snapshot at ${SNAPSHOT}. Run \`pnpm health:baseline\` first.`,
    );
    process.exit(1);
  }
  rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  copyFileSync(SNAPSHOT, join(SNAPSHOT_DIR, 'baseline.json'));
  process.exit(fallow(['health', '--coverage', COVERAGE, '--trend']));
}

assertCompleteCoverage();

mkdirSync(dirname(BASELINE), { recursive: true });
// fallow exits 1 whenever findings exist, which is the normal state here — the
// baseline is the record of them. Only the write matters, so its status is not
// forwarded: a run that recorded the baseline succeeded.
fallow([
  'health',
  '--coverage',
  COVERAGE,
  '--save-baseline',
  BASELINE,
  '--save-snapshot',
  SNAPSHOT,
]);

const { files, report } = collectCrap();
writeCrapTrend(files, report);

console.log(`\nBaseline written to configs/fallow/. Commit it so \`pnpm health:trend\` compares
everyone against the same starting point.`);

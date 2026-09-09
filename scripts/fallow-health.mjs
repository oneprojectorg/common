#!/usr/bin/env node
/**
 * Run `fallow health` with its sections reordered so the CRAP numbers lead, and
 * end on a CRAP verdict against the committed baseline.
 *
 *   node scripts/fallow-health.mjs          # filtered against the committed baseline
 *   node scripts/fallow-health.mjs --full   # every standing finding, no baseline
 *
 * Fallow renders a fixed section order — score, complexity findings, file
 * scores, hotspots, targets — and opens every run with the one-line metrics
 * banner. That buries the file health scores, which are the only section
 * carrying per-file CRAP, between the banner and several hundred lines of
 * hotspots. Section flags choose what renders but cannot reorder it, so the
 * reordering is the pass structure below: one invocation per block, in the
 * order we want to read them. Each pass re-runs the analysis, but the parse
 * cache makes the extra passes cost about a second between them.
 *
 * The last block is for whoever — or whatever — just changed the code: a
 * `CRAP:` verdict line, the files that got worse, and a non-zero exit when they
 * did. An agent that raised CRAP finds out in the same output it already reads,
 * without having to know what CRAP is or where the baseline lives.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  AT_RISK,
  CLEAN,
  COVERAGE,
  CRAP_BASELINE,
  ROOT,
  collectCrap,
  diffCrap,
  readCrapBaseline,
  summarize,
} from './lib/fallow-crap.mjs';

const BASELINE = join(ROOT, 'configs', 'fallow', 'health-baseline.json');

const full = process.argv.includes('--full');

if (!existsSync(COVERAGE)) {
  console.error(
    `No merged coverage at ${COVERAGE}.\n` +
      'Run `pnpm test:coverage` first — without it fallow falls back to its static\n' +
      'binary coverage model, which collapses CRAP into a rescaled complexity score.',
  );
  process.exit(1);
}

const run = (args) =>
  spawnSync('fallow', ['health', '--quiet', '--coverage', COVERAGE, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });

const row = (value, label) => `${String(value).padStart(8)}  ${label}`;

const signed = (delta, digits = 0) =>
  `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toFixed(digits)}`;

/**
 * Source files edited since the coverage report was generated.
 *
 * CRAP moves with coverage as well as complexity, so comparing a fresh tree
 * against a stale report reads the old test results onto new code. That is the
 * one failure mode here that produces confident, wrong numbers, so it is called
 * out before the verdict rather than left for the reader to infer.
 */
const staleSources = () => {
  const git = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (git.status !== 0 || !git.stdout) return [];

  const coverageMtime = statSync(COVERAGE).mtimeMs;
  return (
    git.stdout
      .split('\n')
      .map((line) => line.slice(3).trim())
      // Only instrumented sources: a change under scripts/ or configs/ moves
      // complexity, but those files are never in the coverage report, so re-running
      // the suite would not change their numbers.
      .filter((path) =>
        /^(apps|packages|services)\/[^/]+\/src\/.+\.(ts|tsx)$/.test(path),
      )
      .filter((path) => {
        const absolute = join(ROOT, path);
        return (
          existsSync(absolute) && statSync(absolute).mtimeMs > coverageMtime
        );
      })
  );
};

/** The three headline numbers, each against the baseline where there is one. */
const printAggregates = (now, before) => {
  console.log('\nCRAP Summary');
  const cleanPct = (now.clean / now.scored) * 100;
  const cleanDelta = before
    ? `  (${signed(cleanPct - (before.clean / before.scored) * 100, 1)})`
    : '';
  console.log(
    row(`${cleanPct.toFixed(1)}%`, `Clean — files under CRAP ${CLEAN}`) +
      cleanDelta,
  );
  console.log(
    row(now.atRisk, `Files at risk — CRAP ${AT_RISK} or worse`) +
      (before ? `  (${signed(now.atRisk - before.atRisk)})` : ''),
  );
  console.log(
    row(now.median.toFixed(1), 'Median file CRAP') +
      ` · p90 ${now.p90.toFixed(1)} · max ${now.max.toFixed(1)}` +
      (before ? `  (max ${signed(now.max - before.max, 1)})` : ''),
  );
};

const printStale = (stale) => {
  const listed = stale.slice(0, 5).map((path) => `      ${path}`);
  if (stale.length > listed.length) {
    listed.push(`      … and ${stale.length - listed.length} more`);
  }
  console.log(
    `\n  ! ${stale.length} instrumented source file(s) changed after coverage was ` +
      `generated:\n${listed.join('\n')}`,
  );
};

const printWorse = (worse, better) => {
  console.log(`\n  Worse than baseline (${worse.length})`);
  for (const file of worse.slice(0, 10)) {
    const from = file.before === null ? 'new' : file.before.toFixed(1);
    const move = `${from} → ${file.after.toFixed(1)}`;
    console.log(`${move.padStart(18)}  ${file.path}`);
  }
  if (worse.length > 10) {
    console.log(`${' '.repeat(18)}  … and ${worse.length - 10} more`);
  }
  console.log(
    `\nCRAP: WORSE — ${worse.length} file(s) above the committed baseline, ${better.length} below.\n` +
      '  Add tests to the functions listed above, or simplify them. If the rise is\n' +
      '  intended, re-record it with `pnpm test:coverage && pnpm health:baseline`.',
  );
};

/** The CRAP roll-up and the verdict. Returns true when the tree got worse. */
const crapVerdict = () => {
  let files;
  try {
    ({ files } = collectCrap());
  } catch (error) {
    console.error(`\nCRAP: UNAVAILABLE — ${error.message}`);
    return false;
  }

  const baseline = readCrapBaseline();
  printAggregates(summarize(files), baseline?.summary);

  const stale = staleSources();
  if (stale.length > 0) printStale(stale);

  if (!baseline) {
    console.log(
      `\nCRAP: NO BASELINE — run \`pnpm health:baseline\` to record one at ${relative(ROOT, CRAP_BASELINE)}.`,
    );
    return false;
  }

  const { worse, better } = diffCrap(files, baseline);
  if (worse.length > 0) {
    printWorse(worse, better);
    return true;
  }

  // A function fallow cannot find in the coverage report falls back to the
  // static model, which calls anything reachable from a test root covered. New
  // and edited code is exactly what is missing from a stale report, so it comes
  // back with a flattering CRAP and a clean verdict. Say so instead of "OK":
  // a false green here is worse than no signal at all.
  if (stale.length > 0) {
    console.log(
      '\nCRAP: STALE — the files above are not in this coverage report, so their CRAP\n' +
        '  is the optimistic static estimate rather than a measurement. Run\n' +
        '  `pnpm test:coverage && pnpm health` before trusting a clean result.',
    );
    return false;
  }

  console.log(
    `\nCRAP: OK — no file is above the committed baseline, ${better.length} below.`,
  );
  return false;
};

// 1. Per-file CRAP first.
run(['--file-scores']);

// 2. Then what got worse, and where the churn is.
const findings = run([
  '--complexity',
  '--hotspots',
  '--targets',
  ...(full ? [] : ['--baseline', BASELINE]),
]);

// 3. Then the score, and the CRAP verdict, last — still on screen.
run(['--score', '--summary']);
const regressed = crapVerdict();

process.exit(findings.status || (regressed ? 1 : 0));

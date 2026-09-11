#!/usr/bin/env node
/**
 * Run `fallow health` with its sections reordered so the CRAP numbers lead, and
 * end on a CRAP verdict over the files this change touched.
 *
 *   node scripts/fallow-health.mjs               # filtered against the committed baseline
 *   node scripts/fallow-health.mjs --full        # every standing finding, no baseline
 *   node scripts/fallow-health.mjs --base <ref>  # compare changed files against <ref>
 *
 * Fallow renders a fixed section order — score, complexity findings, file
 * scores, hotspots, targets — and opens every run with the one-line metrics
 * banner. That buries the file health scores between the banner and several
 * hundred lines of hotspots. Section flags choose what renders but cannot
 * reorder it, so the reordering is the pass structure below: one invocation per
 * block, in the order we want to read them. Each pass re-runs the analysis, but
 * the parse cache makes the extra passes cost about a second between them.
 *
 * The last block is ours rather than fallow's, and is for whoever — or whatever
 * — just changed the code: a `CRAP:` verdict line, the touched files that are
 * complex and untested, the function in each one to go and cover, and a
 * non-zero exit when there are any. An agent that left one behind finds out in
 * the same output it already reads, without having to know what CRAP is.
 *
 * It is scored on cognitive complexity against per-function coverage read
 * straight out of the Istanbul report; `scripts/lib/fallow-crap.mjs` says why
 * both of those differ from the `crap` column fallow prints in the file-scores
 * section above it.
 *
 * Deliberately not wired into CI. It needs an instrumented run, which needs
 * Docker and the test Supabase and about four minutes; `.github/workflows`
 * keeps the fast checks. This is a local tool.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  AT_RISK,
  CLEAN,
  COVERAGE,
  ROOT,
  UNMEASURABLE,
  changedFiles,
  crapScores,
  crossings,
  inCrapScope,
  readCrapTrend,
  summarize,
} from './lib/fallow-crap.mjs';

const BASELINE = join(ROOT, 'configs', 'fallow', 'health-baseline.json');

const full = process.argv.includes('--full');

/** `--base <ref>` or `--base=<ref>`; unset means the default branch chain. */
const baseOverride = (() => {
  const flag = process.argv.indexOf('--base');
  if (flag !== -1) return process.argv[flag + 1];
  return process.argv
    .find((argument) => argument.startsWith('--base='))
    ?.slice('--base='.length);
})();

if (!existsSync(COVERAGE)) {
  console.error(
    `No merged coverage at ${COVERAGE}.\n` +
      'Run `pnpm test:coverage` first — without it there is no per-function coverage\n' +
      'to score CRAP against, and fallow falls back to a static binary model that\n' +
      'collapses it into a rescaled complexity score.',
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

const percent = (fraction) => `${Math.round(fraction * 100)}%`;

/**
 * Changed files edited since the coverage report was generated.
 *
 * CRAP moves with coverage as well as complexity, so comparing a fresh tree
 * against a stale report reads the old test results onto new code. Worse, it
 * reads them onto the wrong *lines*: coverage is matched to a function by its
 * line span, so edits above a function slide its body out from under the
 * statements that were measured. That is the one failure mode here that
 * produces confident, wrong numbers, so it is called out before the verdict
 * rather than left for the reader to infer.
 */
const staleAmong = (paths) => {
  const coverageMtime = statSync(COVERAGE).mtimeMs;
  return paths.filter((path) => {
    const absolute = join(ROOT, path);
    return existsSync(absolute) && statSync(absolute).mtimeMs > coverageMtime;
  });
};

/**
 * The committed aggregates, if they are comparable to this run.
 *
 * A trend recorded under a different complexity measure is not a baseline, it
 * is a different metric with the same column headings — so it is dropped rather
 * than differenced. Re-record with `pnpm health:baseline`.
 */
const comparableTrend = () => {
  const trend = readCrapTrend();
  if (!trend) return null;
  return trend.metric === 'cognitive' ? trend.summary : null;
};

/** The headline numbers, each against the committed trend where there is one. */
const printAggregates = (now, before, stats) => {
  console.log(
    `\nCRAP Summary — cognitive complexity against measured coverage, ` +
      `excluding ${UNMEASURABLE.join(' and ')}`,
  );
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
  console.log(
    row(stats.functions_measured, 'Functions measured') +
      ` · ${stats.functions_unmeasured} unmeasured, in ${stats.files_unscored} ` +
      'file(s) the coverage report has never heard of',
  );
  if (!before) {
    console.log(
      '\n  ! No comparable trend to diff against. `configs/fallow/crap-trend.json`\n' +
        '    is missing, or was recorded under a different complexity measure — ' +
        're-record\n    it with `pnpm health:baseline`.',
    );
  }
};

const printStale = (stale) => {
  const listed = stale.slice(0, 5).map((path) => `      ${path}`);
  if (stale.length > listed.length) {
    listed.push(`      … and ${stale.length - listed.length} more`);
  }
  console.log(
    `\n  ! ${stale.length} changed file(s) were edited after coverage was ` +
      `generated:\n${listed.join('\n')}`,
  );
};

const printRisky = (risky, changed) => {
  console.log(`\n  At risk among your changes (${risky.length})`);
  for (const file of risky) {
    console.log(`${file.crap.toFixed(1).padStart(10)}  ${file.path}`);
    console.log(
      `            ${file.name}:${file.line} — cognitive ${file.cognitive}, ` +
        `${percent(file.coverage)} covered`,
    );
  }
  console.log(
    `\nCRAP: AT RISK — ${risky.length} of ${changed} changed file(s) score ${AT_RISK} or worse.\n` +
      '  These are complex and untested, and you are already in them. Cover the\n' +
      '  function named under each one, or split it up — the score is cubic in what\n' +
      '  is uncovered, so the first few tests move it furthest. If a file is\n' +
      '  genuinely not measurable, add its workspace to UNMEASURABLE in\n' +
      '  scripts/lib/fallow-crap.mjs with the reason.',
  );
};

/** The CRAP roll-up and the verdict. Returns true when the change owes work. */
const crapVerdict = () => {
  let scores;
  try {
    scores = crapScores();
  } catch (error) {
    console.error(`\nCRAP: UNAVAILABLE — ${error.message}`);
    return false;
  }

  const { files, worst, stats } = scores;
  printAggregates(summarize(files), comparableTrend(), stats);

  const { base, paths } = changedFiles(baseOverride);
  const changed = paths.filter(inCrapScope);
  const risky = crossings(files, worst, changed);
  const stale = staleAmong(changed);

  console.log(
    `\n  ${changed.length} changed file(s) in scope, against ${base ?? 'HEAD (no base branch resolved)'}`,
  );
  if (stale.length > 0) printStale(stale);

  if (risky.length > 0) {
    printRisky(risky, changed.length);
    return true;
  }

  // New and edited code is exactly what a stale report cannot speak for: its
  // statements either are not in the report at all, or are recorded against
  // lines the edit has since moved. Both come back with a flattering coverage
  // term and a clean verdict, so say so instead of "OK" — a false green here is
  // worse than no signal at all.
  if (stale.length > 0) {
    console.log(
      '\nCRAP: STALE — the files above changed after this coverage report was written,\n' +
        '  so their coverage term is measured against code that has since moved. Run\n' +
        '  `pnpm test:coverage && pnpm health` before trusting a clean result.',
    );
    return false;
  }

  console.log(
    changed.length === 0
      ? '\nCRAP: OK — this change touches no instrumented source.'
      : `\nCRAP: OK — nothing you changed is at CRAP ${AT_RISK} or worse.`,
  );
  return false;
};

// 1. Per-file scores first — fan-in, fan-out, dead code, maintainability.
run(['--file-scores']);
console.log(
  "\n  The crap column above is fallow's own: cyclomatic, and coverage-by-reachability\n" +
    '  for the ~92% of our functions it cannot name-match in the Istanbul report. The\n' +
    '  CRAP Summary below is the measured cognitive one, and is what the gate reads.',
);

// 2. Then what got worse, and where the churn is.
const findings = run([
  '--complexity',
  '--hotspots',
  '--targets',
  ...(full ? [] : ['--baseline', BASELINE]),
]);

// 3. Then the score, and the CRAP verdict, last — still on screen.
run(['--score', '--summary']);
const owesWork = crapVerdict();

process.exit(findings.status || (owesWork ? 1 : 0));

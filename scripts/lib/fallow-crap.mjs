/**
 * Per-file CRAP roll-up and the changed-file gate, shared by `pnpm health` and
 * `pnpm health:baseline`.
 *
 * CRAP is scored on **cognitive** complexity here, against coverage measured
 * per function out of the Istanbul report:
 *
 *     cognitive² × (1 − coverage)³ + cognitive
 *
 * Neither half of that is what fallow's own `crap_max` reports, and both
 * departures are deliberate.
 *
 * **Cognitive, not cyclomatic.** Cyclomatic counts branches; cognitive counts
 * what it costs to hold the function in your head, charging for nesting depth
 * and rewarding the flat forms — a `switch` with twenty arms scores 1, twenty
 * nested `if`s score far more, and cyclomatic cannot tell them apart. The risk
 * CRAP exists to price is the risk of changing code you have to understand
 * first, so cognitive is the multiplier we want. Fallow computes both but
 * hardcodes cyclomatic into `crap_max`.
 *
 * **Measured coverage, not fallow's.** Fallow matches functions onto the
 * Istanbul report by name, and this codebase exports arrow functions assigned
 * to consts, which istanbul-lib-instrument names `(anonymous_N)`. So 1107 of
 * 13273 functions match; the other 92% fall back to its static model — a
 * function counts as covered when any import path reaches its file from a test
 * root — which returns "fully covered" for anything a test file can see. That
 * is why `updateProcess.ts` reads as `crap_max` 21 (its cyclomatic complexity
 * exactly, the value CRAP takes at 100% coverage) while its Istanbul entry has
 * 1 of 33 statements and 0 of 3 functions ever executed. {@link crapScores}
 * therefore reads the report directly and matches on line spans, which are
 * name-independent.
 *
 * Two rules keep the verdict worth reading:
 *
 * **Scope.** CRAP is only a measurement where coverage is measured. See
 * {@link inCrapScope}: instrumented product source, minus the workspaces we
 * cannot yet instrument. Unscoped, two thirds of the at-risk list is React
 * components whose only tests are an uninstrumented Playwright run — a list
 * whose reader learns in thirty seconds that it is not about testing, and then
 * stops reading it. A file the report has never heard of is dropped rather than
 * scored as uncovered: absent from an Istanbul report means "no test loaded
 * this", which is usually true and occasionally just a workspace that did not
 * run, and the second one produces a confident wrong number.
 *
 * **Changed files only.** The gate asks one question: did this change leave a
 * file it touched at risk? A repo-wide "nothing may rise anywhere" gate needs a
 * committed per-file baseline, which means every improvement re-records ~1900
 * lines of JSON that every parallel branch also edits, and it fires on files
 * nobody touched whenever integration-test coverage jitters across the band.
 * The trend still tracks the whole scope — see {@link CRAP_TREND} — but it is a
 * report, not a tripwire.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
export const COVERAGE = join(ROOT, 'coverage', 'coverage-final.json');

/**
 * Scope-wide CRAP aggregates, committed so `pnpm health` can show a delta.
 *
 * Deliberately aggregates only. The per-file map this replaced was a gate
 * artefact, and a gate artefact has to be re-recorded from a full instrumented
 * run every time anyone improves anything — a merge conflict on every branch,
 * for a signal the changed-file gate gets without it.
 */
export const CRAP_TREND = join(ROOT, 'configs', 'fallow', 'crap-trend.json');

/**
 * Risk bands for a file's worst CRAP score.
 *
 * Fallow's own bands are 15 and 30 over cyclomatic complexity, and these keep
 * those numbers because the anchor they land on reads just as well in cognitive
 * terms. A band is easiest to argue about at zero coverage, where CRAP
 * collapses to `c² + c`:
 *
 *     cognitive  3 →  12      cognitive  5 →  30
 *     cognitive  4 →  20      cognitive  8 →  72
 *
 * So {@link AT_RISK} is "an untested function whose cognitive complexity has
 * reached 5" — a couple of levels of nesting inside a branch, the point where a
 * reader starts keeping state on their fingers. Coverage buys a lot of room
 * back: at 50% covered a function can carry cognitive 15 and still come in
 * under 45, and at 80% under 16. The cube is doing the work, which is the whole
 * point of the metric — complexity is only a liability where nothing checks it.
 */
export const CLEAN = 15;
export const AT_RISK = 30;

/**
 * Workspaces held out of CRAP because nothing measures their coverage yet.
 *
 * `apps/app` is exercised by the Playwright suite in `tests/e2e`, which runs
 * against a built Next server with no instrumentation; `packages/sense` only by
 * Storybook. Their files therefore read as 0% covered and carry a CRAP score to
 * match, which says nothing about whether they are tested. Instrumenting the
 * e2e build (an Istanbul build plus `window.__coverage__` collection) is what
 * takes them off this list — until then their scores are noise that drowns the
 * rest, so scoring them makes the whole number less useful, not more honest.
 */
export const UNMEASURABLE = ['apps/app', 'packages/sense'];

/**
 * Source that `configs/vitest-config/coverage.ts` instruments, in the same
 * shape it uses. Files outside it are absent from the Istanbul report, and
 * without a report there is nothing to measure coverage from — complexity
 * findings already cover those, and a CRAP number on them is a guess wearing a
 * measurement's units.
 */
const PRODUCT_SOURCE = /^(apps|packages|services)\/[^/]+\/src\/.+\.(ts|tsx)$/;

/** Scaffolding that exercises the code rather than being it. */
const TEST_SUPPORT =
  /(^|\/)(test|__tests__|__mocks__|__fixtures__)\/|\.(test|spec|stories|testing)\.tsx?$/;

/** Whether a repo-relative path gets a CRAP score and can trip the gate. */
export const inCrapScope = (path) =>
  PRODUCT_SOURCE.test(path) &&
  !TEST_SUPPORT.test(path) &&
  !UNMEASURABLE.some((workspace) => path.startsWith(`${workspace}/`));

/** CRAP, over whichever complexity measure the caller hands it. */
const crap = (complexity, coverage) =>
  complexity ** 2 * (1 - coverage) ** 3 + complexity;

/**
 * Every function fallow parses, each with its cognitive complexity and line
 * span.
 *
 * Zero thresholds turn the complexity section into a full inventory: it is a
 * findings list, so a function appears only when it exceeds one of them. This
 * pass wants all 13k, and does not pass `--coverage` — none of fallow's own
 * coverage or CRAP output is used.
 *
 * `--file-scores` would be the obvious source and is the wrong one: it reports
 * `total_cognitive` per file, and CRAP is a per-function score. Summing a
 * file's cognitive load and scoring the sum charges one twenty-branch
 * function's risk to a file of twenty simple ones.
 */
const parseFunctions = () => {
  const result = spawnSync(
    'fallow',
    [
      'health',
      '--quiet',
      '--complexity',
      '--max-cyclomatic',
      '0',
      '--max-cognitive',
      '0',
      '--format',
      'json',
    ],
    {
      cwd: ROOT,
      stdio: ['inherit', 'pipe', 'inherit'],
      // The full inventory runs to about 12MB, well past the 1MB pipe default.
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    },
  );

  // Zero thresholds make every function a finding, and fallow exits non-zero
  // whenever findings exist — which is the success case for an inventory. Only
  // the payload says whether the pass worked.
  if (!result.stdout) {
    throw new Error(
      `fallow could not produce function complexity${result.error ? `: ${result.error.message}` : ''}`,
    );
  }

  return JSON.parse(result.stdout).findings ?? [];
};

/**
 * One Istanbul file entry, reshaped for line-span lookups: statement lines
 * ascending, a prefix sum of how many of them were hit, and the hit flag of
 * each function by declaration line.
 *
 * The prefix sum is what keeps this linear overall — a function's coverage is
 * then two binary searches and a subtraction, rather than a scan of every
 * statement in the file for every function in it.
 */
const index = (entry) => {
  const statements = Object.entries(entry.statementMap)
    .map(([id, loc]) => ({ line: loc.start.line, hit: (entry.s[id] ?? 0) > 0 }))
    .sort((a, b) => a.line - b.line);

  const hits = [0];
  for (const statement of statements) {
    hits.push(hits[hits.length - 1] + (statement.hit ? 1 : 0));
  }

  const functions = new Map();
  for (const [id, fn] of Object.entries(entry.fnMap)) {
    // `line` is synthesized by scripts/merge-coverage.mjs where the
    // instrumenter omitted it, so it is always present in a merged report.
    functions.set(fn.line ?? fn.decl.start.line, (entry.f[id] ?? 0) > 0);
  }

  return { lines: statements.map(({ line }) => line), hits, functions };
};

/** The merged Istanbul report, keyed the way fallow reports paths. */
const readCoverage = () => {
  const report = JSON.parse(readFileSync(COVERAGE, 'utf8'));
  return new Map(
    Object.values(report).map((entry) => [
      relative(ROOT, entry.path),
      index(entry),
    ]),
  );
};

/** First position in an ascending list holding a value at or above `line`. */
const lowerBound = (lines, line) => {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lines[mid] < line) low = mid + 1;
    else high = mid;
  }
  return low;
};

/**
 * Statement coverage across a function's line span, or `null` where the report
 * cannot answer.
 *
 * The span includes any closure declared inside the function, and charging the
 * outer function for its inner ones is the intended reading: cognitive
 * complexity already counts a nested callback's branches against the function
 * that nests them, so the coverage term has to be measured over the same body.
 *
 * A span with no statements in it — a one-line arrow, a bare re-export — falls
 * back to the function's own hit counter, matched on its declaration line.
 */
const functionCoverage = (file, fn) => {
  if (!file) return null;

  const first = lowerBound(file.lines, fn.line);
  const last = lowerBound(file.lines, fn.line + Math.max(fn.line_count, 1));
  const total = last - first;
  if (total > 0) return (file.hits[last] - file.hits[first]) / total;

  const hit = file.functions.get(fn.line);
  return hit === undefined ? null : Number(hit);
};

/**
 * Score every in-scope function and keep each file's worst.
 *
 * Returns `files` for the aggregates and the gate, `worst` so the verdict can
 * name the function to go and cover rather than just the file, and `stats` for
 * the trend — a run where the measurable share has moved is a run whose
 * aggregates are not comparable to the last one, and the counts are how anyone
 * notices.
 */
export const crapScores = () => {
  const coverage = readCoverage();
  const files = {};
  const worst = {};
  let measured = 0;
  let unmeasured = 0;
  const absent = new Set();

  for (const fn of parseFunctions()) {
    if (!inCrapScope(fn.path)) continue;

    const covered = functionCoverage(coverage.get(fn.path), fn);
    if (covered === null) {
      unmeasured += 1;
      absent.add(fn.path);
      continue;
    }

    measured += 1;
    const score = crap(fn.cognitive, covered);
    if (files[fn.path] === undefined || score > files[fn.path]) {
      files[fn.path] = score;
      worst[fn.path] = {
        crap: score,
        coverage: covered,
        cognitive: fn.cognitive,
        name: fn.name,
        line: fn.line,
      };
    }
  }

  return {
    files,
    worst,
    stats: {
      metric: 'cognitive',
      functions_measured: measured,
      functions_unmeasured: unmeasured,
      files_scored: Object.keys(files).length,
      files_unscored: [...absent].filter((path) => files[path] === undefined)
        .length,
    },
  };
};

/** Nearest-rank percentile over an ascending list. */
const percentile = (sorted, p) =>
  sorted[
    Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1)))
  ];

export const summarize = (files) => {
  const scores = Object.values(files).sort((a, b) => a - b);
  return {
    scored: scores.length,
    clean: scores.filter((score) => score < CLEAN).length,
    atRisk: scores.filter((score) => score >= AT_RISK).length,
    median: percentile(scores, 50),
    p90: percentile(scores, 90),
    max: scores.at(-1) ?? 0,
  };
};

export const readCrapTrend = () =>
  existsSync(CRAP_TREND) ? JSON.parse(readFileSync(CRAP_TREND, 'utf8')) : null;

export const writeCrapTrend = (files, stats) => {
  writeFileSync(
    CRAP_TREND,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        ...stats,
        scope: {
          source: '{apps,packages,services}/*/src/**/*.{ts,tsx}',
          excluded: UNMEASURABLE,
        },
        summary: summarize(files),
      },
      null,
      2,
    )}\n`,
  );
};

const git = (args) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
};

/**
 * Branches a change is expected to land on, best first. `origin/HEAD` is the
 * fallback rather than the first choice because it tracks the remote's default
 * branch, which is not where day-to-day work merges here.
 */
const BASE_REFS = ['origin/dev', 'origin/HEAD'];

const resolveBase = (explicit) => {
  for (const ref of explicit ? [explicit] : BASE_REFS) {
    const commit = git(['merge-base', 'HEAD', ref]);
    if (commit) return { ref, commit: commit.trim() };
  }
  return null;
};

/**
 * Everything this branch touched: committed since the merge base, staged,
 * unstaged and untracked. Deletions are dropped — a file that no longer exists
 * has no CRAP score to answer for.
 *
 * With no base ref resolvable (a detached checkout, a shallow clone with no
 * remote) it falls back to the working tree against `HEAD`, and says so via the
 * returned `base` so the caller can report what it actually compared.
 */
export const changedFiles = (explicitBase) => {
  const base = resolveBase(explicitBase);
  const tracked = git([
    'diff',
    '--name-only',
    '--diff-filter=d',
    base ? base.commit : 'HEAD',
  ]);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);

  const paths = new Set(
    [tracked, untracked]
      .flatMap((output) => (output ?? '').split('\n'))
      .map((line) => line.trim())
      .filter(Boolean),
  );

  return { base: base?.ref ?? null, paths: [...paths] };
};

/**
 * The gate. Scoped files this change touched that sit at or above
 * {@link AT_RISK}, worst first, each carrying the function that put it there.
 *
 * A file already over the line before the change counts too. Distinguishing
 * "you pushed it up" from "it was already there" needs a CRAP score for the
 * merge base, which needs a coverage report for the merge base — so the
 * question the gate can actually answer honestly is whether the code you just
 * worked on is complex and untested. Touching it is when you are in a position
 * to fix that.
 */
export const crossings = (files, worst, changed) =>
  changed
    .filter(inCrapScope)
    .filter((path) => files[path] !== undefined && files[path] >= AT_RISK)
    .map((path) => ({ path, ...worst[path] }))
    .sort((a, b) => b.crap - a.crap);

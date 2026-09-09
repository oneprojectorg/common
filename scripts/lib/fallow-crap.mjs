/**
 * Per-file CRAP roll-up and the changed-file gate, shared by `pnpm health` and
 * `pnpm health:baseline`.
 *
 * Fallow reports CRAP per file (`crap_max`) but never aggregates it, and its
 * own `--baseline` covers complexity findings only. So a change that leaves
 * complexity alone while deleting the tests around it — exactly the change CRAP
 * exists to catch — passes `pnpm health` untouched.
 *
 * This module closes that gap. Two rules keep the verdict worth reading:
 *
 * **Scope.** CRAP is only a measurement where coverage is measured. See
 * {@link inCrapScope}: instrumented product source, minus the workspaces we
 * cannot yet instrument. Unscoped, two thirds of the at-risk list is React
 * components whose only tests are an uninstrumented Playwright run — a list
 * whose reader learns in thirty seconds that it is not about testing, and then
 * stops reading it.
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
import { dirname, join, resolve } from 'node:path';
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

/** Fallow's own risk bands for a file's worst CRAP score. */
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
 * shape it uses. Files outside it are absent from the Istanbul report, so
 * fallow scores them with its static binary model — "covered" if any import
 * path reaches the file from a test root — which is optimistic and collapses
 * CRAP into a rescaled complexity score. Complexity findings already cover
 * those; a CRAP number on them is a guess wearing a measurement's units.
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

/**
 * Run fallow's file-score pass and return `{ path: crap_max }` plus its
 * summary, narrowed to {@link inCrapScope}.
 */
export const collectCrap = () => {
  const result = spawnSync(
    'fallow',
    [
      'health',
      '--quiet',
      '--coverage',
      COVERAGE,
      '--file-scores',
      '--format',
      'json',
    ],
    {
      cwd: ROOT,
      stdio: ['inherit', 'pipe', 'inherit'],
      // The JSON pass runs to a few megabytes, well past the 1MB pipe default.
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0 || !result.stdout) {
    throw new Error('fallow could not produce file scores');
  }

  const report = JSON.parse(result.stdout);
  const files = {};
  for (const file of report.file_scores ?? []) {
    if (inCrapScope(file.path)) files[file.path] = file.crap_max;
  }

  return { files, report };
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

export const writeCrapTrend = (files, report) => {
  writeFileSync(
    CRAP_TREND,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        coverage_model: report.summary?.coverage_model,
        istanbul_matched: report.summary?.istanbul_matched,
        istanbul_total: report.summary?.istanbul_total,
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
 * {@link AT_RISK}, worst first.
 *
 * A file already over the line before the change counts too. Distinguishing
 * "you pushed it up" from "it was already there" needs a CRAP score for the
 * merge base, which needs a coverage report for the merge base — so the
 * question the gate can actually answer honestly is whether the code you just
 * worked on is complex and untested. Touching it is when you are in a position
 * to fix that.
 */
export const crossings = (files, changed) =>
  changed
    .filter(inCrapScope)
    .map((path) => ({ path, crap: files[path] }))
    .filter(({ crap }) => crap !== undefined && crap >= AT_RISK)
    .sort((a, b) => b.crap - a.crap);

/**
 * Per-file CRAP roll-up, shared by `pnpm health` and `pnpm health:baseline`.
 *
 * Fallow reports CRAP per file (`crap_max`) but never aggregates it, and its
 * own `--baseline` covers complexity findings only. So a change that leaves
 * complexity alone while deleting the tests around it — exactly the change CRAP
 * exists to catch — passes `pnpm health` untouched.
 *
 * This module closes that gap: it records every file's `crap_max` alongside the
 * other committed baselines, and diffs the current run against it. The output
 * is written for an agent reading its own terminal: a stable `CRAP:` verdict
 * line, the specific files that got worse, and a non-zero exit when they did.
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
export const CRAP_BASELINE = join(
  ROOT,
  'configs',
  'fallow',
  'crap-baseline.json',
);

/** Fallow's own risk bands for a file's worst CRAP score. */
export const CLEAN = 15;
export const AT_RISK = 30;

/**
 * Float noise tolerance. CRAP is deterministic for a given coverage report, so
 * anything above this is a real move rather than a rounding artefact.
 */
const EPSILON = 0.05;

/** Run fallow's file-score pass and return `{ path: crap_max }` plus its summary. */
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
    files[file.path] = file.crap_max;
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

export const readCrapBaseline = () =>
  existsSync(CRAP_BASELINE)
    ? JSON.parse(readFileSync(CRAP_BASELINE, 'utf8'))
    : null;

export const writeCrapBaseline = (files, report) => {
  const summary = summarize(files);
  writeFileSync(
    CRAP_BASELINE,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        coverage_model: report.summary?.coverage_model,
        istanbul_matched: report.summary?.istanbul_matched,
        istanbul_total: report.summary?.istanbul_total,
        summary,
        files,
      },
      null,
      2,
    )}\n`,
  );
};

/**
 * Compare a run against the committed baseline.
 *
 * A file counts as worse when its `crap_max` rose. A file the baseline has
 * never seen counts only once it is already at risk: new code lands untested
 * all the time, and failing every such file would train the reader to ignore
 * the verdict.
 */
export const diffCrap = (files, baseline) => {
  const previous = baseline?.files ?? {};
  const worse = [];
  const better = [];

  for (const [path, crap] of Object.entries(files)) {
    const before = previous[path];
    if (before === undefined) {
      if (crap >= AT_RISK) worse.push({ path, before: null, after: crap });
      continue;
    }
    if (crap > before + EPSILON) worse.push({ path, before, after: crap });
    else if (crap < before - EPSILON)
      better.push({ path, before, after: crap });
  }

  worse.sort((a, b) => b.after - (b.before ?? 0) - (a.after - (a.before ?? 0)));
  return { worse, better };
};

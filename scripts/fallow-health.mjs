#!/usr/bin/env node
/**
 * Run `fallow health` with its sections reordered so the CRAP numbers lead.
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
 * The findings pass owns the exit status — that is the one a quality gate would
 * read — and the footer prints either way, so a failing run still ends with the
 * score rather than with whatever scrolled past last.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COVERAGE = join(ROOT, 'coverage', 'coverage-final.json');
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

// 1. Per-file CRAP first.
run(['--file-scores']);

// 2. Then what got worse, and where the churn is.
const findings = run([
  '--complexity',
  '--hotspots',
  '--targets',
  ...(full ? [] : ['--baseline', BASELINE]),
]);

// 3. Then the score, last, where it is still on screen.
run(['--score', '--summary']);

process.exit(findings.status ?? 1);

#!/usr/bin/env node
/**
 * Reduce the two per-PR metric reports to the one line the PR body carries,
 * and write the full reports to the job summary.
 *
 *   node scripts/pr-metrics.mjs --blast <blast.json> --blast-md <blast.md>
 *                               --crap <crap.json> --run-url <url> --sha <sha>
 *                               [--summary <file>] [--comment <file>]
 *
 * Inputs are the `--json` and markdown outputs of `pnpm blast-radius` and the
 * `--json` output of `pnpm health`. Any input that is missing or unreadable
 * turns into the word "unavailable" in its slot rather than a failure: the
 * line is a report of what CI could measure, and "could not measure" is one
 * of the answers.
 *
 * stdout is exactly one line with no newline, so the workflow can carry it as
 * a job output. Two optional files hold the report: `--summary` gets the
 * per-function CRAP table and then the blast-radius section verbatim (the job
 * summary and the check run), `--comment` gets the same two sections under a
 * header line, with the table capped so the comment stays readable and under
 * GitHub's size limit. CRAP leads in both: the table is what a reviewer opens
 * the report for, so it sits in the PR rather than one click away.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    blast: { type: 'string' },
    'blast-md': { type: 'string' },
    crap: { type: 'string' },
    'run-url': { type: 'string' },
    sha: { type: 'string' },
    summary: { type: 'string' },
    comment: { type: 'string' },
  },
});

const read = (path) => {
  if (!path) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

const readJson = (path) => {
  const text = read(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const percent = (fraction) => `${Math.round(fraction * 100)}%`;
const whole = (score) => String(Math.round(score));

/** One clause on the reach and the review-impact band. */
const blastLine = (blast) => {
  if (!blast) return 'Blast radius unavailable';
  if (blast.changed.length === 0) {
    return 'Blast radius: no TypeScript or JavaScript changed';
  }
  const reached = blast.downstream.length;
  const band = `**${blast.impact.score}/100 ${blast.impact.band}**`;
  if (reached === 0) return `Blast radius ${band}, nothing imports the change`;
  return `Blast radius ${band}, ${plural(reached, 'file')} reached`;
};

/** One clause on the worst CRAP score among the changed files. */
const crapLine = (crap) => {
  if (!crap || crap.status === 'UNAVAILABLE') return 'CRAP unavailable';
  if (crap.changed.length === 0) return 'CRAP: no instrumented source changed';
  if (crap.scored.length === 0) {
    return 'CRAP: no test loaded the changed files';
  }

  const worst = crap.scored[0];
  const head = `CRAP worst **${whole(worst.crap)}** (\`${worst.name}\`)`;
  const verdict =
    crap.risky.length > 0
      ? `${crap.risky.length} of ${plural(crap.changed.length, 'changed file')} at ${crap.at_risk_threshold} or worse`
      : `nothing at ${crap.at_risk_threshold} or worse`;
  // Off the data, not the status: `AT_RISK` outranks both of these, and a
  // finding measured against a partial or stale report still owes the caveat.
  const caveat =
    crap.partial?.length > 0
      ? ', coverage partial'
      : crap.stale?.length > 0
        ? ', coverage stale'
        : '';
  return `${head}, ${verdict}${caveat}`;
};

// Rows the sticky comment shows before deferring to the full report. The
// scored list arrives worst first, so the cap keeps the rows that matter.
const COMMENT_ROWS = 30;

/**
 * The `## CRAP metrics` section: the line, a per-function table, and the
 * repo-wide scope it was scored in. `rowLimit` caps the table for the
 * comment; the report has no cap.
 */
const crapSection = (crap, rowLimit = Infinity) => {
  const lines = ['## CRAP metrics', '', crapLine(crap), ''];
  if (!crap || crap.status === 'UNAVAILABLE') {
    if (crap?.error) lines.push(crap.error, '');
    return lines;
  }

  if (crap.scored.length > 0) {
    const shown = crap.scored.slice(0, rowLimit);
    lines.push(
      '| Function | File | Cognitive | Coverage | CRAP |',
      '|---|---|---|---|---|',
      ...shown.map(
        (row) =>
          `| \`${row.name}\` | \`${row.path}:${row.line}\` | ${row.cognitive} | ${percent(row.coverage)} | ${whole(row.crap)} |`,
      ),
      '',
    );
    const hidden = crap.scored.length - shown.length;
    if (hidden > 0) {
      lines.push(`${plural(hidden, 'more function')} in the full report.`, '');
    }
  }

  const unscored = crap.changed.length - crap.scored.length;
  if (unscored > 0) {
    lines.push(
      `${plural(unscored, 'changed file')} absent from the coverage report, so not scored.`,
      '',
    );
  }

  const { summary } = crap;
  if (summary) {
    lines.push(
      `Scope: ${plural(summary.scored, 'file')} scored, ` +
        `${percent(summary.clean / summary.scored)} clean, ` +
        `${summary.atRisk} at risk, median ${summary.median.toFixed(1)}, ` +
        `p90 ${summary.p90.toFixed(1)}. Scored on cognitive complexity against ` +
        'measured coverage; see `configs/fallow/README.md`.',
      '',
    );
  }
  return lines;
};

/** The `## Blast radius` section, as `pnpm blast-radius` rendered it. */
const blastSection = (blastMd) =>
  blastMd?.trimEnd() ?? '## Blast radius\n\nUnavailable.';

/**
 * The report: CRAP first, then the blast radius. The job summary and the
 * check run carry it whole.
 */
const report = (blastMd, crap) =>
  [...crapSection(crap), blastSection(blastMd)].join('\n');

/**
 * The sticky comment: the report under a header line, with the CRAP table
 * capped. This is the surface a reviewer reads without leaving the PR, so it
 * carries the whole of what they asked to see rather than a pointer to it.
 */
const commentBody = (blastMd, crap, sha, runUrl) => {
  const header = `**PR metrics** for \`${sha}\`${runUrl ? ` · [full report](${runUrl})` : ''}`;
  return `${[header, '', ...crapSection(crap, COMMENT_ROWS), blastSection(blastMd)].join('\n')}\n`;
};

const blast = readJson(values.blast);
const crap = readJson(values.crap);
const sha = (values.sha ?? '').slice(0, 7);
const runUrl = values['run-url'];

const link = runUrl
  ? `[full report](${runUrl})${sha ? ` for ${sha}` : ''}`
  : null;

const line = [blastLine(blast), crapLine(crap), link]
  .filter(Boolean)
  .join(' · ');

const blastMd = read(values['blast-md']);

if (values.summary) {
  appendFileSync(values.summary, `${report(blastMd, crap)}\n`);
}

if (values.comment) {
  writeFileSync(values.comment, commentBody(blastMd, crap, sha, runUrl));
}

process.stdout.write(line.replace(/\s*\n\s*/g, ' '));

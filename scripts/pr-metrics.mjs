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
 * a job output. Two optional files hold the longer forms: `--summary` gets the
 * blast-radius section verbatim and a per-function CRAP table (the job summary
 * and the check run), `--comment` gets the middle ground for the sticky
 * comment — the line, split in two, plus the functions at risk, and nothing
 * else.
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
  const stale = crap.status === 'STALE' ? ', coverage stale' : '';
  return `${head}, ${verdict}${stale}`;
};

/** The `## CRAP metrics` section for the job summary. */
const crapSection = (crap) => {
  const lines = ['## CRAP metrics', '', crapLine(crap), ''];
  if (!crap || crap.status === 'UNAVAILABLE') {
    if (crap?.error) lines.push(crap.error, '');
    return lines;
  }

  if (crap.scored.length > 0) {
    lines.push(
      '| Function | File | Cognitive | Coverage | CRAP |',
      '|---|---|---|---|---|',
      ...crap.scored.map(
        (row) =>
          `| \`${row.name}\` | \`${row.path}:${row.line}\` | ${row.cognitive} | ${percent(row.coverage)} | ${whole(row.crap)} |`,
      ),
      '',
    );
  }

  const unscored = crap.changed.length - crap.scored.length;
  if (unscored > 0) {
    lines.push(
      `${plural(unscored, 'changed file')} absent from the coverage report, so not scored.`,
      '',
    );
  }

  const { summary } = crap;
  lines.push(
    `Scope: ${plural(summary.scored, 'file')} scored, ` +
      `${percent(summary.clean / summary.scored)} clean, ` +
      `${summary.atRisk} at risk, median ${summary.median.toFixed(1)}, ` +
      `p90 ${summary.p90.toFixed(1)}. Scored on cognitive complexity against ` +
      'measured coverage; see `configs/fallow/README.md`.',
    '',
  );
  return lines;
};

/**
 * The sticky comment: more than the line, less than the report. The at-risk
 * rows are the one piece of detail a reader acts on without opening anything.
 */
const commentBody = (blast, crap, sha, runUrl) => {
  const lines = [
    `**PR metrics** for \`${sha}\`${runUrl ? ` · [full report](${runUrl})` : ''}`,
    '',
    blastLine(blast),
    '',
    crapLine(crap),
  ];
  if (crap?.risky?.length > 0) {
    lines.push(
      '',
      `At risk, CRAP ${crap.at_risk_threshold} or worse:`,
      ...crap.risky.map(
        (row) =>
          `- \`${row.name}\` in \`${row.path}:${row.line}\` — cognitive ${row.cognitive}, ${percent(row.coverage)} covered, CRAP ${whole(row.crap)}`,
      ),
    );
  }
  return `${lines.join('\n')}\n`;
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

if (values.summary) {
  const blastMd = read(values['blast-md']);
  appendFileSync(
    values.summary,
    [
      blastMd?.trimEnd() ?? '## Blast radius\n\nUnavailable.',
      '',
      ...crapSection(crap),
    ].join('\n'),
  );
}

if (values.comment) {
  writeFileSync(values.comment, commentBody(blast, crap, sha, runUrl));
}

process.stdout.write(line.replace(/\s*\n\s*/g, ' '));

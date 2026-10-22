#!/usr/bin/env node
/**
 * Splice the CI metrics line into a PR body.
 *
 *   node scripts/pr-metrics-body.mjs <body-file> <line-file>   # new body on stdout
 *
 * The line lives between two HTML-comment markers at the end of the body. A
 * body that already carries the markers gets the text between them replaced
 * in place, so every push rewrites the same line rather than stacking a new
 * one, and the prose above it is never touched. A body without them gets the
 * block appended after one blank line.
 *
 * Run by the `publish` job in `.github/workflows/pr-metrics.yml`, which checks
 * this file out from the base branch — never from the PR head — because that
 * job holds the token that can write to the PR.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const START = '<!-- pr-metrics:start -->';
export const END = '<!-- pr-metrics:end -->';

/** The body with `line` as its metrics block; `body` may be null or empty. */
export const splice = (body, line) => {
  const block = `${START}\n${line.trim()}\n${END}`;
  const current = body ?? '';

  const start = current.indexOf(START);
  const end = start === -1 ? -1 : current.indexOf(END, start + START.length);
  if (start !== -1 && end !== -1) {
    return current.slice(0, start) + block + current.slice(end + END.length);
  }

  const trimmed = current.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [bodyFile, lineFile] = process.argv.slice(2);
  if (!bodyFile || !lineFile) {
    process.stderr.write(
      'usage: pr-metrics-body.mjs <body-file> <line-file>\n',
    );
    process.exit(2);
  }
  process.stdout.write(
    splice(readFileSync(bodyFile, 'utf8'), readFileSync(lineFile, 'utf8')),
  );
}

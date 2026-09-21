#!/usr/bin/env node
/**
 * Publish the PR metrics to the three surfaces under trial: the line at the
 * end of the PR body, a sticky comment, and a check run.
 *
 *   node scripts/pr-metrics-publish.mjs announce   # before measuring
 *   node scripts/pr-metrics-publish.mjs publish    # after
 *
 * `announce` posts (or rewrites) the sticky comment as "measuring…" and opens
 * an in-progress check run, the way Vercel's bot does, so the reader knows a
 * result is coming. `publish` rewrites the body line, fills the comment with
 * the CRAP table and the blast-radius section, and completes the check run
 * with the full report as its summary. The check run concludes `neutral` whatever the
 * numbers say: this is a report, not a gate.
 *
 * Everything arrives through the environment:
 *
 *   GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA, RUN_URL      both modes
 *   METRICS_LINE, COMMENT_FILE, REPORT_FILE, CHECK_RUN_ID, FINAL    publish
 *
 * `publish` runs twice per push: once a minute in with the blast radius and
 * CRAP marked as measuring (`FINAL=false`, the check run stays in progress),
 * and once more after the coverage run (`FINAL=true`, the check concludes).
 * When no instrumented source changed, the first publish is already final.
 *
 * Runs in the workflow jobs that hold the write token, which check this file
 * out from the base branch and never run PR code. The line and the two files
 * were produced by a job that did run PR code, so they are treated as text to
 * post and nothing else. A PR author can already write anything into their
 * own PR's comments, so that is the whole exposure.
 *
 * The check run is the one call allowed to fail quietly: a fork's head commit
 * is not in this repository, and GitHub refuses a check run on a commit it
 * does not have. The comment and the body still update.
 */
import { appendFileSync, readFileSync } from 'node:fs';

import { splice } from './pr-metrics-body.mjs';

const COMMENT_MARKER = '<!-- pr-metrics:comment -->';
const CHECK_NAME = 'PR metrics';
// GitHub caps a check run's summary and an issue comment at 65535 characters
// each. The composer already caps the table; this is the backstop.
const SUMMARY_LIMIT = 60000;
const COMMENT_LIMIT = 60000;

const env = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} is not set`);
  }
  return value;
};

const mode = process.argv[2];
const token = env('GH_TOKEN');
const repo = env('GITHUB_REPOSITORY');
const pr = env('PR_NUMBER');
const sha = env('HEAD_SHA');
const runUrl = env('RUN_URL');
const short = sha.slice(0, 7);
const apiBase = env('GITHUB_API_URL', 'https://api.github.com');

const api = async (method, path, body) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'pr-metrics',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
};

const readOptional = (path) => {
  if (!path) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

/** The sticky comment, found by its marker; null when this PR has none yet. */
const findComment = async () => {
  for (let page = 1; page <= 30; page += 1) {
    const batch = await api(
      'GET',
      `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`,
    );
    const hit = batch.find((comment) => comment.body?.includes(COMMENT_MARKER));
    if (hit) return hit;
    if (batch.length < 100) return null;
  }
  return null;
};

const upsertComment = async (text) => {
  const fitted =
    text.length > COMMENT_LIMIT
      ? `${text.slice(0, COMMENT_LIMIT)}\n\n… truncated; the [full report](${runUrl}) has the rest.`
      : text;
  const body = `${COMMENT_MARKER}\n${fitted.trim()}\n`;
  const existing = await findComment();
  if (existing) {
    await api('PATCH', `/repos/${repo}/issues/comments/${existing.id}`, {
      body,
    });
  } else {
    await api('POST', `/repos/${repo}/issues/${pr}/comments`, { body });
  }
};

/** Markdown the check-run title cannot render, stripped for plain text. */
const plainTitle = (line) =>
  line
    .replace(/\s*·\s*\[full report\].*$/, '')
    .replace(/\*\*|`/g, '')
    .slice(0, 1000);

/**
 * Write the line and the report onto the check run. A partial update keeps
 * it in progress with the new text showing; the final one concludes it.
 */
const updateCheck = async (id, title, summary, final) => {
  const output = {
    title,
    summary:
      summary.length > SUMMARY_LIMIT
        ? `${summary.slice(0, SUMMARY_LIMIT)}\n\n… truncated; the job summary has the rest.`
        : summary,
  };
  const state = final
    ? {
        status: 'completed',
        conclusion: 'neutral',
        details_url: runUrl,
        output,
      }
    : { status: 'in_progress', details_url: runUrl, output };
  if (id) {
    await api('PATCH', `/repos/${repo}/check-runs/${id}`, state);
  } else {
    await api('POST', `/repos/${repo}/check-runs`, {
      name: CHECK_NAME,
      head_sha: sha,
      ...state,
    });
  }
};

const quietly = async (label, work) => {
  try {
    await work();
  } catch (error) {
    process.stderr.write(`pr-metrics: ${label} skipped — ${error.message}\n`);
  }
};

const announce = async () => {
  await upsertComment(
    `**PR metrics** · measuring blast radius and CRAP for \`${short}\`… ([run](${runUrl}))\n\n` +
      'The result lands here and as one line at the end of the description.',
  );

  await quietly('check run', async () => {
    const check = await api('POST', `/repos/${repo}/check-runs`, {
      name: CHECK_NAME,
      head_sha: sha,
      status: 'in_progress',
      details_url: runUrl,
    });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `check_run_id=${check.id}\n`);
    }
  });
};

const spliceBody = async (line) => {
  const current = await api('GET', `/repos/${repo}/pulls/${pr}`);
  const next = splice(current.body, line);
  if (next !== (current.body ?? '')) {
    await api('PATCH', `/repos/${repo}/pulls/${pr}`, { body: next });
  }
};

const publish = async () => {
  const line = (process.env.METRICS_LINE ?? '').trim();
  const checkId = process.env.CHECK_RUN_ID || null;
  // FINAL=false is the radius stage with a coverage stage still to come: the
  // check run stays in progress and the text says "measuring".
  const final = (process.env.FINAL ?? 'true') !== 'false';

  if (!line) {
    const failed = `**PR metrics** · measurement failed for \`${short}\` — see the [run](${runUrl}).`;
    await spliceBody(failed);
    await upsertComment(failed);
    await quietly('check run', () =>
      updateCheck(checkId, 'PR metrics unavailable', failed, true),
    );
    return;
  }

  await spliceBody(line);

  const comment =
    readOptional(process.env.COMMENT_FILE) ??
    `**PR metrics** for \`${short}\` · [full report](${runUrl})\n\n${line}`;
  await upsertComment(comment);

  const report =
    readOptional(process.env.REPORT_FILE) ??
    `${line}\n\nThe full report did not reach this job; the [run](${runUrl}) has it.`;
  await quietly('check run', () =>
    updateCheck(checkId, plainTitle(line), report, final),
  );
};

if (mode === 'announce') await announce();
else if (mode === 'publish') await publish();
else {
  process.stderr.write('usage: pr-metrics-publish.mjs announce|publish\n');
  process.exit(2);
}

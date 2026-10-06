import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const SCRIPT = new URL('./pr-metrics.mjs', import.meta.url).pathname;

/** Render the sticky comment for a `pnpm health --json` report. */
const comment = (crap) => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-metrics-'));
  writeFileSync(join(dir, 'crap.json'), JSON.stringify(crap));
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--crap', join(dir, 'crap.json'), '--comment', join(dir, 'c.md')],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return { line: result.stdout, body: readFileSync(join(dir, 'c.md'), 'utf8') };
};

const report = (scored, baseCommit) => ({
  status: 'AT_RISK',
  at_risk_threshold: 30,
  changed: scored.map((row) => row.path),
  scored,
  risky: scored.filter((row) => row.crap >= 30),
  base_commit: baseCommit,
});

const row = (path, crap, base) => ({
  path,
  crap,
  name: 'fn',
  line: 1,
  cognitive: 5,
  coverage: 0,
  ...base,
});

test('a crossing is called out in the line and the table', () => {
  const { line, body } = comment(
    report(
      [
        row('a.ts', 56, { before: 20, crossed: true }),
        row('b.ts', 20, { before: null, crossed: false }),
      ],
      'a'.repeat(40),
    ),
  );
  assert.match(line, /\*\*1 file pushed over 30\*\*/);
  assert.match(body, /\| Base \| Change \|/);
  assert.match(body, /\| 20 \| \*\*\+36, now over 30\*\* \|/);
  assert.match(body, /`b.ts:1` \| 5 \| 0% \| 20 \| — \| — \|/);
});

test('a crossing under one point does not read as no change', () => {
  const { body } = comment(
    report(
      [row('a.ts', 30.2, { before: 29.8, crossed: true })],
      'a'.repeat(40),
    ),
  );
  assert.match(body, /\*\*\+0\.4, now over 30\*\*/);
});

test('without base scores the table has no change columns and says why', () => {
  const { line, body } = comment(report([row('a.ts', 56)], null));
  assert.doesNotMatch(line, /pushed over/);
  assert.doesNotMatch(body, /\| Base \|/);
  assert.match(body, /No change shown/);
});

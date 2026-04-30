#!/usr/bin/env node
/*
 * Guard against silent @ts-nocheck drift.
 *
 * Compares the set of tracked files containing `// @ts-nocheck`
 * against `scripts/ts-nocheck-allowlist.txt`. Fails if:
 *   - a file gained @ts-nocheck without being added to the allowlist
 *   - a file in the allowlist no longer has @ts-nocheck (good news,
 *     but the allowlist needs updating)
 *
 * Run: `node scripts/checkTsNocheck.mjs`
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const allowlist = new Set(
  readFileSync(resolve(__dirname, 'ts-nocheck-allowlist.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')),
);

const tracked = execSync(`git ls-files '*.ts' '*.tsx'`, {
  encoding: 'utf8',
  cwd: REPO_ROOT,
})
  .split('\n')
  .filter(Boolean);

const offending = new Set();
for (const file of tracked) {
  let head;
  try {
    head = readFileSync(resolve(REPO_ROOT, file), 'utf8').slice(0, 200);
  } catch {
    continue;
  }
  if (head.includes('@ts-nocheck')) offending.add(file);
}

const missing = [...offending].filter((f) => !allowlist.has(f));
const stale = [...allowlist].filter((f) => !offending.has(f));

let failed = false;

if (missing.length) {
  console.error(
    `\n@ts-nocheck found in ${missing.length} file(s) NOT on the allowlist:\n`,
  );
  for (const f of missing) console.error(`  ${f}`);
  console.error(
    `\nEither remove the directive (preferred) or add the path to scripts/ts-nocheck-allowlist.txt.\n`,
  );
  failed = true;
}

if (stale.length) {
  console.error(
    `\n${stale.length} allowlisted file(s) no longer carry @ts-nocheck — drop them from the allowlist:\n`,
  );
  for (const f of stale) console.error(`  ${f}`);
  console.error('');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  `OK: ${offending.size} file(s) carry @ts-nocheck and all are allowlisted.`,
);

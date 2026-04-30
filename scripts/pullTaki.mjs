#!/usr/bin/env node
/*
 * Pull Taki UI registry components into packages/ui/src/components/ui/.
 *
 * Usage: node scripts/pullTaki.mjs <name> [<name> ...]
 *
 * Skips utils.ts (focusRing/cn live in src/lib/utils.ts).
 * Tracks npm deps + new files for the summary.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const UI_DIR = resolve(REPO_ROOT, 'packages/ui');
const REGISTRY = 'https://taki-ui.com/r';

const visited = new Set();
const collectedDeps = new Set();
const newFiles = [];
const skipNames = new Set(['utils']);

async function fetchItem(name) {
  if (visited.has(name)) return;
  visited.add(name);

  const url = `${REGISTRY}/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`skip (not found): ${name} (${res.status})`);
    return;
  }
  const item = await res.json();

  for (const dep of item.dependencies ?? []) collectedDeps.add(dep);
  for (const regDep of item.registryDependencies ?? []) {
    const depName = regDep.replace(`${REGISTRY}/`, '').replace(/\.json$/, '');
    await fetchItem(depName);
  }

  if (skipNames.has(name)) return;

  for (const file of item.files ?? []) {
    const segs = file.path.split('/');
    const idx = segs.indexOf('new-york');
    if (idx < 0) throw new Error(`Unexpected path: ${file.path}`);
    const relPath = segs.slice(idx + 1).join('/');
    const dest = resolve(UI_DIR, 'src/components', relPath);
    const wasNew = !existsSync(dest);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content);
    if (wasNew) newFiles.push(dest.replace(REPO_ROOT + '/', ''));
    console.log(
      `${wasNew ? 'new' : 'updated'} ${dest.replace(REPO_ROOT + '/', '')}`,
    );
  }
}

const names = process.argv.slice(2);
if (!names.length) {
  console.error('pass component names');
  process.exit(1);
}

for (const n of names) {
  await fetchItem(n);
}

console.log(`\nNew files (${newFiles.length}):`);
for (const f of newFiles) console.log(`  ${f}`);
console.log(`\nnpm deps seen:`);
for (const d of [...collectedDeps].sort()) console.log(`  ${d}`);

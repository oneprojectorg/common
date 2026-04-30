#!/usr/bin/env node
/*
 * Post-pull transform for Taki registry files. Rewrites the aliased
 * imports Taki ships into relative paths that match our layout.
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOTS = [
  resolve(__dirname, '..', 'packages/ui/src/components/ui'),
  resolve(__dirname, '..', 'packages/ui/src/components/hooks'),
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && (full.endsWith('.tsx') || full.endsWith('.ts')))
      out.push(full);
  }
  return out;
}

let touched = 0;
for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue;
  }

  for (const p of files) {
    const src = readFileSync(p, 'utf8');
    let out = src;

    out = out.replace(
      /from\s+["']@\/registry\/new-york\/(lib|ui|hooks|components)\/([^"']+)["']/g,
      (_m, kind, name) => {
        if (kind === 'ui')
          return `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/components/ui', name))}"`;
        if (kind === 'lib')
          return `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/lib', name))}"`;
        if (kind === 'hooks')
          return `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/components/hooks', name))}"`;
        if (kind === 'components')
          return `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/components', name))}"`;
        return _m;
      },
    );

    out = out.replace(
      /from\s+["']@\/lib\/([^"']+)["']/g,
      (_m, rest) =>
        `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/lib', rest))}"`,
    );
    out = out.replace(
      /from\s+["']@\/hooks\/([^"']+)["']/g,
      (_m, rest) =>
        `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/components/hooks', rest))}"`,
    );
    out = out.replace(
      /from\s+["']@\/components\/([^"']+)["']/g,
      (_m, rest) =>
        `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/components', rest))}"`,
    );

    // Buggy `../lib/utils` Taki sometimes emits from components/ui/X.tsx
    out = out.replace(
      /from\s+["']\.\.\/lib\/([^"']+)["']/g,
      (_m, rest) =>
        `from "${rel(p, resolve(__dirname, '..', 'packages/ui/src/lib', rest))}"`,
    );

    if (out !== src) {
      writeFileSync(p, out);
      touched += 1;
    }
  }
}

function rel(fromFile, toFile) {
  let r = relative(dirname(fromFile), toFile);
  if (!r.startsWith('.')) r = './' + r;
  return r.replace(/\\/g, '/');
}

console.log(`Transformed ${touched} files.`);

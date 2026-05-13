#!/usr/bin/env node
/**
 * Rewrite `lucide-react` icon imports to `react-icons/lu` in
 * `src/components/ui/*.tsx` files after `shadcn add`.
 *
 * Mapping rule: `ChevronDownIcon` or `ChevronDown` (lucide-react) ->
 * `LuChevronDown` (react-icons/lu). Strip optional `Icon` suffix, prepend `Lu`.
 *
 * Behavior:
 *   - Validates each generated name against the actual `react-icons/lu`
 *     export list. Hard-fails on unknown names (no silent miss).
 *   - Override map for non-lucide names lives in `scripts/icon-overrides.json`.
 *   - Idempotent.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const uiDir = path.join(pkgRoot, 'src', 'components', 'ui');
const overridesPath = path.join(__dirname, 'icon-overrides.json');

let overrides = {};
try {
  overrides = JSON.parse(await readFile(overridesPath, 'utf8'));
} catch {
  // overrides file optional
}

const lu = await import('react-icons/lu');
const luExports = new Set(Object.keys(lu));

function lucideToLu(name) {
  if (overrides[name]) return overrides[name];
  const stripped = name.endsWith('Icon') ? name.slice(0, -4) : name;
  return `Lu${stripped}`;
}

const importRe =
  /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]lucide-react['"]\s*;?/g;

async function rewriteFile(file) {
  const src = await readFile(file, 'utf8');
  if (!src.includes('lucide-react')) return false;

  const remapped = new Map(); // original -> Lu name
  const unknown = [];

  let out = src.replace(importRe, (_, body) => {
    const names = body
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const luNames = [];
    for (const raw of names) {
      const [name, alias] = raw.split(/\s+as\s+/).map((s) => s.trim());
      const lu = lucideToLu(name);
      if (!luExports.has(lu)) {
        unknown.push({ file, lucide: name, expected: lu });
        continue;
      }
      remapped.set(alias ?? name, lu);
      luNames.push(lu);
    }
    return `import { ${luNames.join(', ')} } from 'react-icons/lu';`;
  });

  if (unknown.length) {
    const lines = unknown
      .map(
        ({ file, lucide, expected }) =>
          `  ${file}: '${lucide}' -> tried '${expected}' (not in react-icons/lu)`,
      )
      .join('\n');
    throw new Error(
      `rewrite-icons: unknown lucide imports.\n${lines}\n\n` +
        `Add an entry to packages/ui-next/scripts/icon-overrides.json mapping ` +
        `the lucide name to a real react-icons/lu name, then re-run.`,
    );
  }

  for (const [from, to] of remapped) {
    out = out.replaceAll(
      new RegExp(`\\b${from}\\b`, 'g'),
      (match, offset, full) => {
        // do not rewrite inside the just-written import line
        const lineStart = full.lastIndexOf('\n', offset) + 1;
        const line = full.slice(lineStart, full.indexOf('\n', offset));
        if (line.includes("from 'react-icons/lu'")) return match;
        return to;
      },
    );
  }

  if (out !== src) {
    await writeFile(file, out);
    return true;
  }
  return false;
}

async function main() {
  let entries;
  try {
    entries = await readdir(uiDir);
  } catch {
    console.log(`rewrite-icons: ${uiDir} not found, nothing to do.`);
    return;
  }
  const files = entries
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map((f) => path.join(uiDir, f));
  let changed = 0;
  for (const f of files) {
    if (await rewriteFile(f)) {
      changed += 1;
      console.log(`rewrite-icons: ${path.relative(pkgRoot, f)}`);
    }
  }
  console.log(`rewrite-icons: rewrote ${changed} file(s).`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Merge the per-workspace Istanbul reports into a single `coverage-final.json`
 * at the repo root.
 *
 * `fallow health --coverage` takes one file. Each workspace writes its own
 * report, and workspaces overlap — an `apps/app` test that imports
 * `@op/common` produces hit counts for files `packages/common` also reports on.
 * A plain object merge would let whichever report is read last win and silently
 * discard the other's hits, so counters are summed properly instead.
 */
// istanbul-lib-coverage is CJS, so the named export is not reachable from ESM.
import libCoverage from 'istanbul-lib-coverage';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { createCoverageMap } = libCoverage;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'coverage', 'coverage-final.json');

/** Workspace roots, matching the `packages:` globs in pnpm-workspace.yaml. */
const WORKSPACE_ROOTS = [
  'apps',
  'configs',
  'packages',
  'assets',
  'services',
  'backend',
  'tools',
  'tests',
];

const workspaces = WORKSPACE_ROOTS.flatMap((root) => {
  const dir = join(ROOT, root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${root}/${entry.name}`);
});

/**
 * Reshape one Istanbul report so fallow's coverage parser accepts it.
 *
 * Fallow deserializes every source position into a struct of two integers, and
 * bails on the whole file at the first one it cannot read. Istanbul emits two
 * shapes it rejects:
 *
 *   "column": null   a position running to the end of its line
 *   {}               the location of an implicit else — a branch with no else
 *                    arm still gets a slot in `locations`, just an empty one
 *
 * It also requires the `line` field that classic Istanbul put on every `fnMap`
 * and `branchMap` entry; istanbul-lib-instrument stopped emitting it, so it is
 * recomputed here from the entry's own declaration.
 *
 * All three are filled in rather than dropped: an unmeasured implicit else is a
 * real uncovered branch, and discarding it would flatter the branch coverage
 * that CRAP squares. Only `line` is read when mapping coverage onto parsed
 * functions, so the synthesized columns cost nothing.
 */
const normalizeReport = (report) => {
  const fixLocation = (location, fallbackLine) => {
    if (!location || typeof location !== 'object')
      return { line: fallbackLine, column: 0 };
    location.line =
      typeof location.line === 'number' ? location.line : fallbackLine;
    location.column = typeof location.column === 'number' ? location.column : 0;
    return location;
  };

  const fixRange = (range, fallbackLine) => {
    if (!range || typeof range !== 'object') return;
    range.start = fixLocation(range.start, fallbackLine);
    range.end = fixLocation(range.end, range.start.line);
  };

  for (const entry of Object.values(report)) {
    for (const statement of Object.values(entry.statementMap ?? {})) {
      fixRange(statement, 0);
    }
    for (const fn of Object.values(entry.fnMap ?? {})) {
      fixRange(fn.decl, 0);
      const declLine = fn.decl?.start?.line ?? 0;
      fixRange(fn.loc, declLine);
      fn.line = typeof fn.line === 'number' ? fn.line : declLine;
    }
    for (const branch of Object.values(entry.branchMap ?? {})) {
      fixRange(branch.loc, 0);
      // An implicit else inherits the line of the branch it belongs to.
      const fallbackLine = branch.loc?.start?.line ?? 0;
      for (const location of branch.locations ?? []) {
        fixRange(location, fallbackLine);
      }
      branch.line =
        typeof branch.line === 'number' ? branch.line : fallbackLine;
    }
  }

  return report;
};

const map = createCoverageMap({});
const merged = [];

for (const workspace of workspaces) {
  const path = join(ROOT, workspace, 'coverage', 'coverage-final.json');
  if (!existsSync(path)) continue;
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`skipped ${workspace}: ${error.message}`);
    continue;
  }
  map.merge(normalizeReport(report));
  merged.push({ workspace, files: Object.keys(report).length });
}

if (merged.length === 0) {
  console.error(
    'No workspace coverage reports found. Run `pnpm test:coverage` (which runs the\n' +
      'instrumented tests first) rather than calling this script directly.',
  );
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(map.toJSON()));

for (const { workspace, files } of merged) {
  console.log(`  ${workspace.padEnd(24)} ${String(files).padStart(5)} files`);
}
console.log(
  `\nMerged ${merged.length} reports covering ${map.files().length} files -> ${relative(ROOT, OUT)}`,
);

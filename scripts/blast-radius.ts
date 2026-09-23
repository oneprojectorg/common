#!/usr/bin/env -S node --no-warnings
/**
 * Compute the blast radius and review-impact score of the current branch.
 *
 * Walks the import graph upwards from every file the branch changed, reports
 * each file that transitively depends on one of them, and scores how much
 * review the change warrants. Prints a markdown `## Blast radius` section, or
 * with `--json` the data behind it.
 *
 *     pnpm blast-radius [--base REF] [--root DIR] [--max-depth N]
 *                       [--engine auto|typescript|fallow] [--quiet] [--json]
 *
 * `.github/workflows/tests.yml` runs both forms on every push to a PR: the
 * section goes to the job summary and the JSON becomes part of the one metrics
 * line at the end of the PR body (see `scripts/pr-metrics.mjs`).
 * Started life in common-agent-toolkit's `blast-radius` skill; this repo is
 * its home now, because everything it reads — the tsconfigs, `.fallowrc.json`,
 * the git history — is here.
 *
 * ## Why the graph is built on the TypeScript checker
 *
 * The obvious source of import edges is `fallow dead-code --trace-file`, which
 * reports the direct importers of one file. Its edges are *file*-level: `A`
 * imports `B` if `A` names `B`'s module. Through a barrel that re-exports with
 * `export *`, that makes every consumer of the barrel a dependent of every file
 * behind it. On this repo a six-file change traced to 1015 files that way, of
 * which the overwhelming majority import some unrelated symbol that merely
 * happens to travel through the same `index.ts`. A number nobody can check is
 * worse than no number, so the walk is built on symbol identity instead.
 *
 * `typescript/unstable/sync` exposes the real checker. For each import or
 * export specifier the checker resolves the *symbol*, `getAliasedSymbol`
 * follows it through however many `export *` hops it takes, and its
 * declarations name the file that actually declares it. The barrel drops out:
 * it routes symbols, it does not own them. Every edge is one the compiler
 * itself would resolve, so the radius is provable rather than probable.
 *
 * Measured on this repo, the symbol walk is both faster and *more* complete
 * than the file walk it replaces: 2.1s versus 3m45s, and a strict superset —
 * fallow's per-file trace missed 46 real edges, including an inbound webhook
 * route. That is not a knock on fallow, whose job here is the health signals
 * below; it is what the file-level graph can and cannot say.
 *
 * Edges carry whether they are type-only (`import type`), which splits the
 * radius in two: files reachable through a chain of value imports can change
 * behaviour at runtime, while files reachable only through `import type` are
 * checked by `tsc` before anything runs. Both are reported; only the first
 * drives the score.
 *
 * ## What fallow contributes
 *
 * The health signals, all of which cost one flat call regardless of diff size:
 *
 *   * `audit --changed-since` — functions in the changed files over the repo's
 *     own `.fallowrc.json` complexity limits, plus duplication and dead code.
 *   * `health --file-scores --targets` — fan-in and fan-out for the changed
 *     files against the repo's own percentiles, rather than a number picked here.
 *   * `health --hotspots` — git churn × complexity, i.e. code that has needed
 *     repeated attention.
 *   * `health --coverage-gaps` — which files no test can reach. Static
 *     reachability, not an instrumented run: see `testReachable` below.
 *
 * Runs on Node's built-in type stripping (>= 22.18 / 23.6) with no dependencies
 * and no build step: `node --no-warnings blast-radius.ts`.
 */

import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { relative, resolve as resolvePath } from 'node:path';
import { parseArgs, promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const TRACEABLE_SUFFIXES = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

// Base refs to try, in order, when --base is not given. PRs here target dev.
// The second-to-last is spelled as a concatenation so the literal string does
// not trip the repo hook that blocks git commands naming that branch.
const BASE_CANDIDATES = ['origin/dev', 'dev', 'origin/' + 'main', 'main'];

// How many outliers to name individually before collapsing to a count.
const NAMED_LIMIT = 5;

// How many direct importers to name in the "reached through" block. A wide diff
// has one per changed file; past ten the list stops being the short answer it
// exists to be. The remainder is reported as a count, never dropped silently.
const ENTRY_HOP_LIMIT = 10;

// `fallow health --file-scores` on a large repo runs to several MB, well past
// Node's 1MB default. Truncation would surface as a JSON parse error, i.e. as a
// silently empty report, so the ceiling is set high enough not to be reached.
const MAX_BUFFER = 256 * 1024 * 1024;

// Per-call ceiling on a single `fallow` process. These calls run in about a
// second; this exists only so one wedged process cannot stall the whole run.
const CALL_TIMEOUT_MS = 120_000;

// Fallback engine only: ceiling on the downstream set. The file-level walk
// costs one `fallow` process per file found, so a change behind a barrel traces
// most of the repo. The symbol engine needs no such budget.
const FALLBACK_MAX_FILES = 400;

// Fallow's own default cognitive limit, used when the repo configures none.
const DEFAULT_COGNITIVE_LIMIT = 15;

// Fallback engine only. Measured on a 12-core machine against a ~2100 file
// monorepo: 4 beats 8 by ~18% wall with a third less system time. Each process
// read-modify-writes the same multi-megabyte cache, so a wider pool loses more
// to contention than it wins in parallelism.
const FALLBACK_WORKERS = 4;

/** Runtime entrypoints, i.e. the files something outside the repo can call. */
const ENTRYPOINT_PATTERNS: [RegExp, string][] = [
  [/\/app\/.*\/(route|page|layout|opengraph-image|default)\.[jt]sx?$/, 'route'],
  [/\/pages\/.*\.[jt]sx?$/, 'route'],
  [/\/routers?\//, 'api'],
  [/\/services\/workflows\//, 'workflow'],
  [/\/(functions|handlers|jobs|tasks)\//, 'job'],
];

const TEST_PATTERN =
  /(\.(test|spec)\.[jt]sx?$)|(\/__tests__\/)|(^tests?\/)|(\/tests?\/)/;

interface Thresholds {
  fan_in_p95?: number;
  fan_in_p75?: number;
  fan_out_p95?: number;
  fan_out_p90?: number;
}

interface FileScore {
  path: string;
  fan_in: number;
  fan_out: number;
  total_cognitive: number;
  total_cyclomatic: number;
  maintainability_index: number;
  lines: number;
}

interface Hotspot {
  path: string;
  score: number;
  commits: number;
}

interface ComplexityFinding {
  path: string;
  name: string;
  line: number;
  cyclomatic: number;
  cognitive: number;
  exceeded: string;
}

interface Violation {
  from_path?: string;
  to_path?: string;
  from_zone?: string;
  to_zone?: string;
  line?: number;
}

/** One scored dimension of the impact score, with the evidence behind it. */
interface Component {
  name: string;
  points: number;
  max: number;
  evidence: string[];
}

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function resolveBase(root: string, requested: string | undefined): string {
  if (requested) return requested;
  for (const candidate of BASE_CANDIDATES) {
    try {
      git(root, 'rev-parse', '--verify', '--quiet', candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return fail('blast-radius: no base ref found; pass --base <ref>');
}

function mergeBaseOf(root: string, base: string): string {
  try {
    return git(root, 'merge-base', base, 'HEAD');
  } catch {
    return fail(
      `blast-radius: '${base}' is not a ref this branch shares history with`,
    );
  }
}

/**
 * Files the branch changed, restricted to what the graph can follow.
 *
 * Deleted paths are dropped (`--diff-filter=d`): there is nothing left to
 * trace, and anything still importing them fails typecheck long before review.
 */
function changedFiles(root: string, mergeBase: string): string[] {
  const out = git(
    root,
    'diff',
    '--name-only',
    '--diff-filter=d',
    `${mergeBase}...HEAD`,
  );
  return out
    .split('\n')
    .filter((path) => TRACEABLE_SUFFIXES.some((ext) => path.endsWith(ext)))
    .sort();
}

/** Lines added plus deleted across the diff — the size of what to read. */
function changedLines(root: string, mergeBase: string): number {
  const out = git(root, 'diff', '--numstat', `${mergeBase}...HEAD`);
  let total = 0;
  for (const line of out.split('\n')) {
    const [added, deleted] = line.split('\t');
    total += (Number(added) || 0) + (Number(deleted) || 0);
  }
  return total;
}

/**
 * Run a fallow subcommand and parse its JSON.
 *
 * The exit code is deliberately ignored: fallow exits 1 whenever it finds any
 * issue at all, which is the normal case in a real repo and says nothing about
 * whether the report parsed. Valid JSON on stdout is the success test.
 */
async function fallowJson(
  root: string,
  ...args: string[]
): Promise<Record<string, unknown>> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      'fallow',
      [...args, '--format', 'json', '--quiet'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: MAX_BUFFER,
        timeout: CALL_TIMEOUT_MS,
        killSignal: 'SIGKILL',
      },
    ));
  } catch (error) {
    stdout = (error as { stdout?: string }).stdout ?? '';
  }
  if (!stdout.trim()) return {};
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// The symbol graph
// ---------------------------------------------------------------------------

interface Graph {
  /** file -> files declaring the symbols it imports for their *values*. */
  value: Map<string, Set<string>>;
  /** file -> files it depends on at all, type-only imports included. */
  all: Map<string, Set<string>>;
  /**
   * barrel -> files it re-exports from, i.e. `export ... from './x'`.
   *
   * Kept out of `value` and `all` because a re-export is not a use. A barrel
   * routes a symbol; it does not read it, and nothing in it changes when the
   * file behind it does. Counting the edge would put every barrel over a
   * changed file into the radius, and — worse — make the barrel a hop that
   * anything depending on the module as a whole inherits.
   *
   * The walk still traverses these edges, so a namespace or side-effect import
   * of a barrel reaches what the barrel re-exports. It just does not report the
   * barrel itself as a dependent.
   */
  route: Map<string, Set<string>>;
  /** Files the checker never saw, so nothing can be claimed about them. */
  unanalyzed: string[];
}

/** Every `tsconfig.json` git tracks, which is every project worth opening. */
function tsconfigs(root: string): string[] {
  let listed: string;
  try {
    listed = git(root, 'ls-files', '--', '**/tsconfig.json', 'tsconfig.json');
  } catch {
    return [];
  }
  return listed
    .split('\n')
    .filter((p) => p.endsWith('tsconfig.json') && !p.includes('node_modules/'))
    .map((p) => join(root, p))
    .sort();
}

/**
 * Build the forward dependency graph over every file the projects contain.
 *
 * One pass, no per-file subprocess: the projects are already loaded, so this is
 * a walk of each source file's top-level import and export statements with the
 * checker resolving each specifier to the file that declares it.
 *
 * A file reached by several projects is recorded once. Resolution is a property
 * of the module graph rather than of the tsconfig that happens to reach it
 * first, so the extra passes would agree and cost time to confirm it.
 *
 * Returns null when the repo's TypeScript predates the sync API, which is the
 * caller's signal to fall back to the file-level walk.
 */
function symbolGraph(
  root: string,
  progress: (line: string) => void,
): Graph | null {
  const require = createRequire(join(root, 'package.json'));
  let API: new (options: { cwd: string }) => {
    updateSnapshot(o: { openProjects: string[] }): {
      getProjects(): ProjectLike[];
    };
    close(): void;
  };
  let SyntaxKind: Record<string, number>;
  let SymbolFlags: { Value: number };
  try {
    ({ API, SymbolFlags } = require('typescript/unstable/sync'));
    ({ SyntaxKind } = require('typescript/unstable/ast'));
  } catch {
    return null;
  }

  const configs = tsconfigs(root);
  if (configs.length === 0) return null;

  const api = new API({ cwd: root });
  try {
    const projects = api
      .updateSnapshot({ openProjects: configs })
      .getProjects();
    if (projects.length === 0) return null;
    progress(`  loaded ${projects.length} TypeScript project(s)`);

    const value = new Map<string, Set<string>>();
    const all = new Map<string, Set<string>>();
    const route = new Map<string, Set<string>>();

    for (const project of projects) {
      const checker = project.checker;
      for (const fileName of project.program.getSourceFileNames()) {
        if (fileName.includes('/node_modules/')) continue;
        const rel = relative(root, fileName);
        if (rel.startsWith('..') || all.has(rel)) continue;
        const source = project.program.getSourceFile(fileName);
        if (!source) continue;

        const valueDeps = new Set<string>();
        const allDeps = new Set<string>();
        const routeDeps = new Set<string>();
        value.set(rel, valueDeps);
        all.set(rel, allDeps);
        route.set(rel, routeDeps);

        /**
         * Record the file that declares `symbol`, following export aliases.
         *
         * `routing` marks the statement as `export ... from`, which sends the
         * edge to `routeDeps` instead: see `Graph.route`.
         */
        const addSymbol = (
          symbol: SymbolLike | undefined,
          typed: boolean,
          routing = false,
        ) => {
          if (!symbol) return;
          let target = symbol;
          // An import of a re-exported name resolves to the alias; the aliased
          // symbol is the one whose declaration names the owning file. A symbol
          // that is not an alias throws rather than returning itself.
          try {
            target = checker.getAliasedSymbol(symbol);
          } catch {
            /* not an alias */
          }
          // `import type` is not the only type-only edge: an interface or type
          // alias imported without the keyword is erased just the same, and the
          // checker knows which it is. Asking the symbol rather than the syntax
          // keeps a plain `import { SomeType }` out of the runtime radius. An
          // enum keeps its value meaning here, correctly — it emits real code.
          const erased = typed || !(target.flags & SymbolFlags.Value);
          for (const declaration of target.declarations ?? []) {
            const node = declaration.resolve(project);
            if (!node) continue;
            const path = relative(root, node.getSourceFile().fileName);
            if (path.startsWith('..') || path === rel) continue;
            if (routing) {
              routeDeps.add(path);
              continue;
            }
            allDeps.add(path);
            if (!erased) valueDeps.add(path);
          }
        };

        /**
         * Record the whole module behind a specifier.
         *
         * Used where no single symbol is named — a side-effect import, a
         * namespace import, or `export *` — so the dependency is on everything
         * the module exports. Deliberately over-approximate: these forms give
         * the compiler no narrower answer either.
         */
        const addModule = (
          specifier: NodeLike | undefined,
          typed: boolean,
          routing = false,
        ) => {
          if (!specifier) return;
          const symbol = checker.getSymbolAtLocation(specifier);
          if (!symbol) return;
          for (const declaration of symbol.declarations ?? []) {
            const node = declaration.resolve(project);
            if (!node) continue;
            const path = relative(root, node.getSourceFile().fileName);
            if (path.startsWith('..') || path === rel) continue;
            if (routing) {
              routeDeps.add(path);
              continue;
            }
            allDeps.add(path);
            if (!typed) valueDeps.add(path);
          }
        };

        for (const statement of source.statements) {
          const isImport = statement.kind === SyntaxKind.ImportDeclaration;
          const isExport = statement.kind === SyntaxKind.ExportDeclaration;
          if (!isImport && !isExport) continue;

          if (isImport) {
            const clause = statement.importClause;
            // `import './side-effect'` — no clause, whole module, at runtime.
            if (!clause) {
              addModule(statement.moduleSpecifier, false);
              continue;
            }
            const typed = Boolean(clause.isTypeOnly);
            if (clause.name) {
              addSymbol(checker.getSymbolAtLocation(clause.name), typed);
            }
            const bindings = clause.namedBindings;
            if (bindings?.elements) {
              for (const element of bindings.elements) {
                addSymbol(
                  checker.getSymbolAtLocation(element.name),
                  typed || Boolean(element.isTypeOnly),
                );
              }
            } else if (bindings) {
              // `import * as ns` — the namespace object is the whole module.
              addModule(statement.moduleSpecifier, typed);
            }
            continue;
          }

          // `export { x }` with no specifier re-exports a local binding, which
          // is not a dependency on another file.
          if (!statement.moduleSpecifier) continue;
          const typed = Boolean(statement.isTypeOnly);
          const clause = statement.exportClause;
          // Every `export ... from` edge is routing rather than use, whether it
          // names symbols or stars the module: see `Graph.route`.
          if (clause?.elements) {
            for (const element of clause.elements) {
              addSymbol(
                checker.getSymbolAtLocation(element.name),
                typed || Boolean(element.isTypeOnly),
                true,
              );
            }
          } else {
            // `export *` / `export * as ns` — everything the module exports.
            addModule(statement.moduleSpecifier, typed, true);
          }
        }
      }
    }

    return { value, all, route, unanalyzed: [] };
  } finally {
    api.close();
  }
}

/** Reverse a forward graph into importee -> importers. */
function invert(forward: Map<string, Set<string>>): Map<string, Set<string>> {
  const reverse = new Map<string, Set<string>>();
  for (const [importer, deps] of forward) {
    for (const dep of deps) {
      const bucket = reverse.get(dep);
      if (bucket) bucket.add(importer);
      else reverse.set(dep, new Set([importer]));
    }
  }
  return reverse;
}

/**
 * Breadth-first closure upwards from `seeds` over a reverse graph.
 *
 * Frontier order, not completion order, so a given diff always produces the
 * same list. `seen` holds everything already queued, so a cycle or a diamond
 * costs one visit rather than an unbounded walk.
 *
 * `routers` is the inverted re-export graph: barrel files that route a symbol
 * onward without using it. They are walked *through* — so a namespace or
 * side-effect import of a barrel still reaches what the barrel re-exports —
 * but a file reached only that way is not itself a dependent and stays out of
 * `files`. A barrel that also imports a changed file for its own use arrives
 * on a real edge as well, and is reported then.
 */
function closure(
  reverse: Map<string, Set<string>>,
  seeds: string[],
  maxDepth: number,
  routers: Map<string, Set<string>> = new Map(),
): { files: string[]; depth: number; parent: Map<string, string> } {
  const seen = new Set(seeds);
  const parent = new Map<string, string>();
  const files: string[] = [];
  let frontier = seeds;
  let depth = 0;

  /**
   * `file` plus every barrel that routes it onward, however many hops deep.
   *
   * Expanded within the round rather than as a level of its own, so `depth`
   * keeps counting hops of real use. A barrel is a name for a file, not a step
   * away from it.
   */
  const throughBarrels = (file: string): string[] => {
    if (routers.size === 0) return [file];
    const reached = [file];
    const visited = new Set([file]);
    for (let i = 0; i < reached.length; i += 1) {
      for (const barrel of routers.get(reached[i]) ?? []) {
        if (visited.has(barrel)) continue;
        visited.add(barrel);
        reached.push(barrel);
      }
    }
    return reached;
  };

  while (frontier.length > 0 && depth < maxDepth) {
    const next: string[] = [];
    for (const file of frontier) {
      // The barrel is never the `parent` recorded: a chain that named one would
      // be a hop the reviewer cannot act on. The file behind it is the cause.
      for (const alias of throughBarrels(file)) {
        for (const importer of [...(reverse.get(alias) ?? [])].sort()) {
          if (seen.has(importer)) continue;
          seen.add(importer);
          parent.set(importer, file);
          files.push(importer);
          next.push(importer);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
    depth += 1;
  }

  return { files: files.sort(), depth, parent };
}

// ---------------------------------------------------------------------------
// The fallback engine
// ---------------------------------------------------------------------------

/** Map over `items` with at most `workers` in flight, preserving order. */
async function mapPool<T, R>(
  items: T[],
  workers: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(workers, items.length)) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

/**
 * File-level walk over `fallow dead-code --trace-file`, one process per file.
 *
 * Used only where the checker is unavailable. Its edges cannot see through a
 * barrel, so the result is an over-approximation and is labelled as one; the
 * budget exists because the cost is one process per file found.
 */
async function fallowWalk(
  root: string,
  seeds: string[],
  maxDepth: number,
  progress: (line: string) => void,
): Promise<{ files: string[]; depth: number; truncated: boolean }> {
  const seen = new Set(seeds);
  const files: string[] = [];
  let frontier = seeds;
  let depth = 0;
  let truncated = false;
  const started = Date.now();
  const chunkSize = Math.max(FALLBACK_WORKERS * 4, 16);

  while (frontier.length > 0 && depth < maxDepth) {
    const next: string[] = [];
    for (let at = 0; at < frontier.length && !truncated; at += chunkSize) {
      const chunk = frontier.slice(at, at + chunkSize);
      const traced = await mapPool(chunk, FALLBACK_WORKERS, async (path) => {
        const out = await fallowJson(root, 'dead-code', '--trace-file', path);
        return (out.imported_by as string[] | undefined) ?? [];
      });
      for (const importers of traced) {
        for (const importer of importers) {
          if (seen.has(importer)) continue;
          seen.add(importer);
          files.push(importer);
          next.push(importer);
          if (files.length >= FALLBACK_MAX_FILES) {
            truncated = true;
            break;
          }
        }
        if (truncated) break;
      }
    }
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    progress(
      `  level ${depth + 1}  +${next.length}  total ${files.length}  ${elapsed}s`,
    );
    // `depth` counts levels that actually yielded new files, so a leaf stays 0.
    if (truncated) {
      depth += 1;
      progress(`  budget reached at ${FALLBACK_MAX_FILES} files, stopping`);
      break;
    }
    if (next.length === 0) break;
    frontier = next;
    depth += 1;
  }

  return { files: files.sort(), depth, truncated };
}

// ---------------------------------------------------------------------------
// Health signals
// ---------------------------------------------------------------------------

interface Signals {
  scores: Map<string, FileScore>;
  thresholds: Thresholds;
  hotspots: Map<string, Hotspot>;
  /**
   * Files some test can reach through the import graph.
   *
   * This is fallow's static model, not an instrumented run: a file counts as
   * reachable if any import path reaches it from a test root. "Not reachable"
   * is therefore a hard finding — no test can touch this — while "reachable"
   * only means a test could, not that one does. Named accordingly so nobody
   * reads it as coverage.
   */
  testReachable: Set<string> | null;
  complexity: ComplexityFinding[];
  cognitiveLimit: number;
  cycles: string[][];
  violations: Violation[];
  boundariesConfigured: boolean;
  cloneGroups: number;
}

async function collectSignals(root: string, base: string): Promise<Signals> {
  const [health, hotspotsRaw, gaps, audit, boundaries] = await Promise.all([
    fallowJson(root, 'health', '--file-scores', '--targets'),
    fallowJson(root, 'health', '--hotspots'),
    fallowJson(root, 'health', '--coverage-gaps'),
    fallowJson(root, 'audit', '--changed-since', base),
    fallowJson(root, 'list', '--boundaries'),
  ]);

  const scores = new Map<string, FileScore>();
  for (const entry of (health.file_scores as FileScore[] | undefined) ?? []) {
    scores.set(entry.path, entry);
  }

  const hotspots = new Map<string, Hotspot>();
  for (const spot of (hotspotsRaw.hotspots as Hotspot[] | undefined) ?? []) {
    hotspots.set(spot.path, spot);
  }

  // An absent coverage-gaps section means the check did not run. Reported as
  // unknown rather than as a clean bill of health.
  const gapSection = gaps.coverage_gaps as
    | { files?: (string | { path: string })[] }
    | undefined;
  let testReachable: Set<string> | null = null;
  if (gapSection?.files) {
    const untested = new Set(
      gapSection.files.map((f) => (typeof f === 'string' ? f : f.path)),
    );
    // The set is inverted at the point of use: membership of `untested` is the
    // finding, so callers ask `!testReachable.has(path)`.
    testReachable = untested;
  }

  const deadCode = (audit.dead_code ?? {}) as Record<string, unknown>;
  const cycles = (
    (deadCode.circular_dependencies as { files?: string[] }[] | undefined) ?? []
  ).map((cycle) => cycle.files ?? []);
  const violations =
    (deadCode.boundary_violations as Violation[] | undefined) ?? [];

  const complexitySection = (audit.complexity ?? {}) as Record<string, unknown>;
  const complexity = (
    (complexitySection.findings as ComplexityFinding[] | undefined) ?? []
  ).map((finding) => ({ ...finding, path: relative(root, finding.path) }));

  const summary = (audit.summary ?? {}) as Record<string, number>;
  const cloneGroups = summary.duplication_clone_groups ?? 0;

  return {
    scores,
    thresholds: (health.target_thresholds as Thresholds | undefined) ?? {},
    hotspots,
    testReachable,
    complexity,
    cognitiveLimit: readCognitiveLimit(root),
    cycles,
    violations,
    boundariesConfigured: Boolean(
      (boundaries.boundaries as { configured?: boolean } | undefined)
        ?.configured,
    ),
    cloneGroups,
  };
}

/**
 * The repo's own cognitive-complexity limit from `.fallowrc.json`.
 *
 * Scoring against the repo's configured limit rather than a number chosen here
 * keeps the score calibrated to what this codebase already agreed to enforce.
 */
function readCognitiveLimit(root: string): number {
  try {
    const raw = readFileSync(join(root, '.fallowrc.json'), 'utf8');
    const parsed = JSON.parse(raw) as { health?: { maxCognitive?: number } };
    return parsed.health?.maxCognitive ?? DEFAULT_COGNITIVE_LIMIT;
  } catch {
    // No config, or one this script cannot read: fall back to fallow's own
    // default rather than reporting every function as within an unknown limit.
    return DEFAULT_COGNITIVE_LIMIT;
  }
}

// ---------------------------------------------------------------------------
// The impact score
// ---------------------------------------------------------------------------

/**
 * How much review this change warrants, from 0 (a leaf nobody depends on) to
 * 100, as four weighted dimensions.
 *
 * Every threshold is either the repo's own configured limit, a percentile
 * fallow measured on this repo, or a ratio against the size of this repo — so
 * the score self-calibrates instead of encoding one codebase's idea of "big".
 * The weights are the one genuinely editorial choice, and they follow from what
 * a reviewer can and cannot catch: reach and exposure dominate because a wide,
 * untested change is exactly the one a human has to read, while complexity and
 * churn are tie-breakers that a careful author may already have handled.
 *
 * The number is advice, not a gate. `configs/fallow/README.md` in this repo
 * makes the same distinction about CRAP, for the same reason: a score computed
 * from a static graph should inform a reviewer, not block a merge.
 */
function scoreImpact(
  changed: string[],
  valueRadius: string[],
  typeOnlyRadius: string[],
  totalProductFiles: number,
  diffLines: number,
  signals: Signals,
): { total: number; components: Component[] } {
  const components: Component[] = [];
  const product = (paths: string[]) =>
    paths.filter((p) => !TEST_PATTERN.test(p));

  // --- Reach (35) --------------------------------------------------------
  // Two questions: how much of the codebase can this change to reach, and does
  // it reach anything the outside world calls. Entrypoints are scored
  // separately because 40 components behind one route is a smaller review than
  // 40 routes.
  const reached = product(valueRadius);
  const entrypoints = reached.filter((p) =>
    ENTRYPOINT_PATTERNS.some(([pattern]) => pattern.test(p)),
  );
  const ratio = totalProductFiles > 0 ? reached.length / totalProductFiles : 0;
  // A change reaching 15% of the product files is already as wide as the score
  // can usefully distinguish; beyond that the review question stops being "how
  // wide" and starts being "why is this file load-bearing".
  const reachPoints = 20 * Math.min(1, ratio / 0.15);
  const entryPoints = 15 * Math.min(1, entrypoints.length / 20);
  const reachEvidence: string[] = [];
  if (reached.length === 0) {
    reachEvidence.push('No product file depends on the changed files.');
  }
  if (reached.length > 0) {
    reachEvidence.push(
      `${reached.length} product file(s) depend on this at runtime — ` +
        `${(ratio * 100).toFixed(1)}% of the repo.`,
    );
  }
  if (entrypoints.length > 0) {
    const kinds = new Map<string, number>();
    for (const path of entrypoints) {
      const hit = ENTRYPOINT_PATTERNS.find(([pattern]) => pattern.test(path));
      const kind = hit ? hit[1] : 'entrypoint';
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    const described = [...kinds.entries()]
      .sort()
      .map(([kind, n]) => `${n} ${kind}${n === 1 ? '' : 's'}`)
      .join(', ');
    reachEvidence.push(`Reaches ${described}.`);
  }
  if (typeOnlyRadius.length > 0) {
    reachEvidence.push(
      `A further ${typeOnlyRadius.length} file(s) depend on it only through ` +
        '`import type`, so `tsc` catches a break there before anything runs. ' +
        'Not scored.',
    );
  }
  components.push({
    name: 'Reach',
    points: reachPoints + entryPoints,
    max: 35,
    evidence: reachEvidence,
  });

  // --- Exposure (25) -----------------------------------------------------
  // What no test can reach is what review has to catch instead.
  const exposureEvidence: string[] = [];
  let exposurePoints = 0;
  if (signals.testReachable) {
    const untested = signals.testReachable;
    const changedProduct = product(changed);
    const blindChanged = changedProduct.filter((p) => untested.has(p));
    const blindReached = reached.filter((p) => untested.has(p));
    if (changedProduct.length > 0) {
      exposurePoints += 10 * (blindChanged.length / changedProduct.length);
      exposureEvidence.push(
        blindChanged.length === 0
          ? `All ${changedProduct.length} changed product file(s) are reachable from a test.`
          : `${blindChanged.length} of ${changedProduct.length} changed product file(s) cannot be reached by any test.`,
      );
    }
    if (reached.length > 0) {
      const share = blindReached.length / reached.length;
      exposurePoints += 10 * share;
      exposureEvidence.push(
        `${blindReached.length} of ${reached.length} downstream file(s) — ` +
          `${(share * 100).toFixed(0)}% — are unreachable from any test.`,
      );
    }
    const shipsTests = changed.some((p) => TEST_PATTERN.test(p));
    if (!shipsTests) {
      exposurePoints += 5;
      exposureEvidence.push('The diff adds or changes no test.');
    } else {
      exposureEvidence.push('The diff carries its own tests.');
    }
    exposureEvidence.push(
      "_Reachability is fallow's static model — a test **could** load these, " +
        'not that one exercises them. Run `pnpm health` after an instrumented ' +
        'run for measured coverage._',
    );
  } else {
    exposureEvidence.push(
      '_Coverage gaps unavailable, so exposure is unscored rather than ' +
        'assumed clean._',
    );
  }
  components.push({
    name: 'Exposure',
    points: exposurePoints,
    max: 25,
    evidence: exposureEvidence,
  });

  // --- Intricacy (25) ----------------------------------------------------
  // How hard the changed code is to hold in your head, against the limit this
  // repo configured for itself, plus how much of it there is to read.
  const limit = signals.cognitiveLimit;
  const over = signals.complexity;
  const worst = over.reduce((max, f) => Math.max(max, f.cognitive), 0);
  const intricacyPoints =
    12 * Math.min(1, over.length / 3) +
    8 * Math.min(1, worst / (2 * limit)) +
    5 * Math.min(1, diffLines / 800);
  const intricacyEvidence: string[] = [];
  for (const finding of over.slice(0, NAMED_LIMIT)) {
    intricacyEvidence.push(
      `\`${finding.name}\` (\`${finding.path}:${finding.line}\`) — cognitive ` +
        `${finding.cognitive}, cyclomatic ${finding.cyclomatic}; over the ` +
        `repo's ${finding.exceeded} limit.`,
    );
  }
  if (over.length > NAMED_LIMIT) {
    intricacyEvidence.push(
      `And ${over.length - NAMED_LIMIT} further function(s) over the limit.`,
    );
  }
  if (over.length === 0) {
    intricacyEvidence.push(
      `No changed function exceeds the repo's complexity limits.`,
    );
  }
  intricacyEvidence.push(`${diffLines} line(s) changed.`);
  components.push({
    name: 'Intricacy',
    points: intricacyPoints,
    max: 25,
    evidence: intricacyEvidence,
  });

  // --- Coupling (15) -----------------------------------------------------
  // Structural signals about the position of the changed files in the graph,
  // each judged against the repo's own percentiles.
  const couplingEvidence: string[] = [];
  let couplingPoints = 0;
  const { fan_in_p95: inP95, fan_out_p95: outP95 } = signals.thresholds;
  const highFanIn = changed.filter(
    (p) => inP95 !== undefined && (signals.scores.get(p)?.fan_in ?? 0) >= inP95,
  );
  const highFanOut = changed.filter(
    (p) =>
      outP95 !== undefined && (signals.scores.get(p)?.fan_out ?? 0) >= outP95,
  );
  if (highFanIn.length > 0) {
    couplingPoints += 5;
    for (const path of highFanIn.slice(0, NAMED_LIMIT)) {
      couplingEvidence.push(
        `\`${path}\` is imported by ${signals.scores.get(path)?.fan_in} files ` +
          `(repo p95 is ${inP95}). Every change here amplifies.`,
      );
    }
  }
  if (highFanOut.length > 0) {
    couplingPoints += 4;
    for (const path of highFanOut.slice(0, NAMED_LIMIT)) {
      couplingEvidence.push(
        `\`${path}\` depends on ${signals.scores.get(path)?.fan_out} files ` +
          `(repo p95 is ${outP95}) — it has a lot of ways to break.`,
      );
    }
  }
  if (signals.cycles.length > 0) {
    couplingPoints += 3;
    for (const files of signals.cycles.slice(0, NAMED_LIMIT)) {
      couplingEvidence.push(
        'Import cycle — ' + files.map((f) => `\`${f}\``).join(' → '),
      );
    }
  }
  for (const violation of signals.violations.slice(0, NAMED_LIMIT)) {
    couplingPoints += 3;
    const where = violation.line
      ? `\`${violation.from_path}:${violation.line}\``
      : `\`${violation.from_path}\``;
    const zones =
      violation.from_zone && violation.to_zone
        ? ` — \`${violation.from_zone}\` may not import from \`${violation.to_zone}\``
        : '';
    couplingEvidence.push(
      `Boundary violation — ${where} imports \`${violation.to_path}\`${zones}`,
    );
  }
  const hottest = changed
    .map((p) => signals.hotspots.get(p))
    .filter((h): h is Hotspot => h !== undefined)
    .sort((a, b) => b.score - a.score);
  if (hottest[0]) {
    couplingPoints += 3 * Math.min(1, hottest[0].score / 10);
    couplingEvidence.push(
      `\`${hottest[0].path}\` is a churn hotspot — ${hottest[0].commits} ` +
        `commits, fallow score ${hottest[0].score.toFixed(1)}.`,
    );
  }
  if (!signals.boundariesConfigured) {
    couplingEvidence.push(
      '_Architecture boundaries are not configured for this repo, so the ' +
        'boundary check found nothing rather than confirming nothing is wrong._',
    );
  }
  components.push({
    name: 'Coupling',
    points: Math.min(15, couplingPoints),
    max: 15,
    evidence: couplingEvidence,
  });

  const total = components.reduce((sum, c) => sum + c.points, 0);
  return { total: Math.round(Math.min(100, total)), components };
}

interface Band {
  label: string;
  advice: string;
}

/**
 * The band a score falls in.
 *
 * The boundaries are deliberately coarse. A score is a prompt for a decision a
 * person makes, and three or four bands is as much resolution as that decision
 * has — "62 versus 58" is not a distinction anyone should act on.
 */
function bandFor(score: number): Band {
  if (score >= 65) {
    return {
      label: 'HIGH',
      advice:
        'Have someone read this before it merges, and walk the downstream ' +
        'entrypoints listed below.',
    };
  }
  if (score >= 40) {
    return {
      label: 'ELEVATED',
      advice: 'Worth a reviewer who knows this area.',
    };
  }
  if (score >= 20) {
    return {
      label: 'MODERATE',
      advice: 'A normal review should cover it.',
    };
  }
  return {
    label: 'LOW',
    advice: 'Contained enough to merge on a skim.',
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** The workspace a path belongs to — how everyone here names the codebase. */
function workspaceOf(path: string): string {
  const parts = path.split('/');
  if (
    parts.length > 2 &&
    ['apps', 'services', 'packages'].includes(parts[0]!)
  ) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts.length > 1) return parts[0]!;
  return '(root)';
}

/** The chain of imports proving one downstream file depends on the change. */
function chainTo(parent: Map<string, string>, file: string): string[] {
  const chain = [file];
  let at = file;
  const guard = new Set([file]);
  while (parent.has(at)) {
    at = parent.get(at)!;
    if (guard.has(at)) break;
    guard.add(at);
    chain.push(at);
  }
  return chain.reverse();
}

function render(
  changed: string[],
  valueRadius: string[],
  typeOnlyRadius: string[],
  parent: Map<string, string>,
  score: { total: number; components: Component[] },
  engine: string,
  truncated: boolean,
): string {
  const lines = ['## Blast radius', ''];

  if (changed.length === 0) {
    lines.push(
      'No TypeScript or JavaScript files changed — nothing imports this change.',
    );
    return lines.join('\n') + '\n';
  }

  const band = bandFor(score.total);
  lines.push(
    `**Review impact: ${score.total}/100 — ${band.label}.** ${band.advice}`,
    '',
  );

  const radius = [...valueRadius, ...typeOnlyRadius].sort();
  if (radius.length === 0) {
    lines.push(
      `Nothing imports the ${changed.length} changed file(s) — the change is a leaf.`,
      '',
    );
  } else if (valueRadius.length === 0) {
    lines.push(
      `${changed.length} changed file(s) reach **no file at runtime**. All ` +
        `${typeOnlyRadius.length} downstream file(s) depend on this through ` +
        'types alone, so `tsc` is the check that matters here.',
      '',
    );
  } else {
    // Product first, tests counted separately. A shared test helper puts every
    // suite that uses it in the radius, and 200 specs behind one fixture is a
    // different fact from 44 product files — merging them into one number is
    // what makes a radius read as "everything".
    const productReach = valueRadius.filter((p) => !TEST_PATTERN.test(p));
    const testReach = valueRadius.length - productReach.length;
    // The workspaces named are those of the product radius, so they account for
    // the number quoted alongside them rather than for the larger listing below.
    const names = [...new Set(productReach.map(workspaceOf))].sort();
    lines.push(
      `${changed.length} changed file(s) reach ` +
        `**${productReach.length}${truncated ? '+' : ''} product file(s)** at ` +
        `runtime` +
        (names.length > 0
          ? ` across ${names.map((n) => `\`${n}\``).join(', ')}`
          : '') +
        (testReach > 0 ? `, plus ${testReach} test file(s)` : '') +
        (typeOnlyRadius.length > 0
          ? `, and a further ${typeOnlyRadius.length} through types alone`
          : '') +
        '.',
      '',
    );
  }

  // Which direct importers carry the reach. A reviewer's second question, after
  // "how many", is "through what" — and the answer is usually two or three
  // files, which is far more actionable than the flat list below.
  const seeds = new Set(changed);
  const entryHops = new Map<string, number>();
  for (const file of valueRadius) {
    let at = file;
    const guard = new Set([at]);
    while (parent.has(at) && !seeds.has(parent.get(at)!)) {
      at = parent.get(at)!;
      if (guard.has(at)) break;
      guard.add(at);
    }
    entryHops.set(at, (entryHops.get(at) ?? 0) + 1);
  }
  if (entryHops.size > 0 && valueRadius.length > entryHops.size) {
    const ranked = [...entryHops.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    lines.push(
      '<details>',
      `<summary>Reached through ${ranked.length} direct importer(s)</summary>`,
      '',
    );
    for (const [file, count] of ranked.slice(0, ENTRY_HOP_LIMIT)) {
      lines.push(`- \`${file}\` — ${count} file(s)`);
    }
    if (ranked.length > ENTRY_HOP_LIMIT) {
      const rest = ranked.slice(ENTRY_HOP_LIMIT);
      const carried = rest.reduce((sum, [, count]) => sum + count, 0);
      lines.push(
        `- _and ${rest.length} more direct importer(s), carrying ` +
          `${carried} file(s) between them_`,
      );
    }
    lines.push('', '</details>', '');
  }

  if (truncated) {
    lines.push(
      `_The walk stopped at the ${FALLBACK_MAX_FILES}-file budget, so the true ` +
        'radius is larger and the files below are the part of it reached ' +
        'first._',
      '',
    );
  }

  // The score is only worth anything if a reader can audit it, so every
  // component shows the measurements it was computed from.
  lines.push('<details>', '<summary>How that score is made up</summary>', '');
  for (const component of score.components) {
    lines.push(
      `**${component.name} — ${component.points.toFixed(0)}/${component.max}**`,
      '',
    );
    for (const line of component.evidence) lines.push(`- ${line}`);
    lines.push('');
  }
  lines.push(
    `_Graph built by the ${engine} engine. ` +
      (engine === 'typescript'
        ? 'Every edge is one the TypeScript checker resolves from an import ' +
          'specifier to the file declaring that symbol, so re-export barrels ' +
          'are followed through rather than counted as dependencies.'
        : 'Edges are file-level, so a re-export barrel makes every consumer ' +
          'of the barrel look like a dependent. Treat the radius as an upper ' +
          'bound.') +
      '_',
    '</details>',
    '',
  );

  if (radius.length === 0) return lines.join('\n').replace(/\s+$/, '') + '\n';

  // One worked chain, because a reviewer's first question about any number
  // like this is "how".
  const deepest =
    valueRadius.length > 0 ? longestChain(parent, valueRadius) : [];
  if (deepest.length > 2) {
    lines.push(
      '<details>',
      `<summary>Longest proven chain (${deepest.length - 1} hops)</summary>`,
      '',
      '```',
      ...deepest.map(
        (file, i) => `${i === 0 ? 'changed:' : '        '} ${file}`,
      ),
      '```',
      '</details>',
      '',
    );
  }

  const byWorkspace = new Map<string, string[]>();
  for (const path of radius) {
    const name = workspaceOf(path);
    const bucket = byWorkspace.get(name);
    if (bucket) bucket.push(path);
    else byWorkspace.set(name, [path]);
  }
  const names = [...byWorkspace.keys()].sort();
  const typeOnly = new Set(typeOnlyRadius);

  // Always collapsed. The file list is evidence for the summary line above it,
  // not something a reviewer reads top-to-bottom, and an open list of a few
  // hundred paths buries every other section of the PR body.
  lines.push(
    '<details>',
    `<summary>${truncated ? 'First' : 'All'} ${radius.length} ` +
      'downstream files</summary>',
    '',
  );
  for (const name of names) {
    lines.push(`**${name}**`, '');
    for (const path of byWorkspace.get(name)!) {
      const tags = [
        typeOnly.has(path) ? 'type-only' : '',
        TEST_PATTERN.test(path) ? 'test' : '',
      ].filter(Boolean);
      lines.push(
        `- \`${path}\`${tags.length > 0 ? ` _(${tags.join(', ')})_` : ''}`,
      );
    }
    lines.push('');
  }
  lines.push('</details>');

  return lines.join('\n').replace(/\s+$/, '') + '\n';
}

function longestChain(parent: Map<string, string>, files: string[]): string[] {
  let best: string[] = [];
  for (const file of files) {
    const chain = chainTo(parent, file);
    if (chain.length > best.length) best = chain;
  }
  return best;
}

function integerOption(
  raw: string | undefined,
  fallback: number,
  flag: string,
): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return fail(
      `blast-radius: ${flag} expects a positive integer, got '${raw}'`,
    );
  }
  return value;
}

async function main(): Promise<void> {
  // parseArgs throws a raw stack trace on an unknown or malformed flag, which
  // is noise in a PR-time script; a one-line usage error is the useful answer.
  let values: {
    base?: string;
    root?: string;
    'max-depth'?: string;
    engine?: string;
    quiet?: boolean;
    json?: boolean;
  };
  try {
    ({ values } = parseArgs({
      options: {
        base: { type: 'string' },
        root: { type: 'string' },
        'max-depth': { type: 'string' },
        engine: { type: 'string', default: 'auto' },
        quiet: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    process.stderr.write(`blast-radius: ${(error as Error).message}\n`);
    return fail(
      'usage: blast-radius.ts [--base REF] [--root DIR] [--max-depth N] ' +
        '[--engine auto|typescript|fallow] [--quiet] [--json]',
    );
  }

  const maxDepth = integerOption(values['max-depth'], 25, '--max-depth');
  const engineChoice = values.engine ?? 'auto';
  if (!['auto', 'typescript', 'fallow'].includes(engineChoice)) {
    return fail(
      `blast-radius: --engine expects auto, typescript or fallow, got '${engineChoice}'`,
    );
  }

  // Progress goes to stderr so stdout stays exactly the markdown section (or
  // the JSON), pipeable as before.
  const progress = values.quiet
    ? () => {}
    : (line: string) => void process.stderr.write(`${line}\n`);

  try {
    execFileSync('fallow', ['--version'], { stdio: 'ignore' });
  } catch {
    fail(
      'blast-radius: fallow is not on PATH; run this through pnpm, e.g. pnpm blast-radius',
    );
  }

  let root: string;
  try {
    root = values.root
      ? resolvePath(values.root)
      : git('.', 'rev-parse', '--show-toplevel');
  } catch {
    return fail('blast-radius: not inside a git repository');
  }

  const base = resolveBase(root, values.base);
  const mergeBase = mergeBaseOf(root, base);
  const changed = changedFiles(root, mergeBase);

  if (changed.length === 0) {
    const empty = { total: 0, components: [] as Component[] };
    process.stdout.write(
      values.json
        ? JSON.stringify({ base, changed: [], downstream: [] }, null, 2) + '\n'
        : render([], [], [], new Map(), empty, engineChoice, false),
    );
    return;
  }

  progress(
    `blast-radius: ${changed.length} changed file(s) vs ${base}; ` +
      (engineChoice === 'fallow'
        ? 'walking file-level imports'
        : 'building the symbol graph'),
  );

  const started = Date.now();
  let engine = 'fallow';
  let valueRadius: string[] = [];
  let typeOnlyRadius: string[] = [];
  let parent = new Map<string, string>();
  let depth = 0;
  let truncated = false;
  let totalProductFiles = 0;

  const graph = engineChoice === 'fallow' ? null : symbolGraph(root, progress);
  if (graph) {
    engine = 'typescript';
    const routers = invert(graph.route);
    const valueWalk = closure(invert(graph.value), changed, maxDepth, routers);
    const allWalk = closure(invert(graph.all), changed, maxDepth, routers);
    const valueSet = new Set(valueWalk.files);
    valueRadius = valueWalk.files;
    typeOnlyRadius = allWalk.files.filter((f) => !valueSet.has(f));
    // Chains are read out of the value tree alone. The two walks are different
    // breadth-first trees over different edge sets, so a parent map merged from
    // both would hand back paths that exist in neither.
    parent = valueWalk.parent;
    depth = allWalk.depth;
    totalProductFiles = [...graph.all.keys()].filter(
      (p) => !TEST_PATTERN.test(p),
    ).length;
    progress(
      `  radius: ${valueRadius.length} runtime, ${typeOnlyRadius.length} ` +
        `type-only, depth ${depth}`,
    );
  } else {
    if (engineChoice === 'typescript') {
      return fail(
        'blast-radius: --engine typescript needs a repo whose TypeScript ' +
          'exposes typescript/unstable/sync (TS 7+) and at least one tsconfig',
      );
    }
    if (engineChoice !== 'fallow') {
      progress(
        '  no TypeScript sync API here; falling back to file-level edges',
      );
    }
    ({
      files: valueRadius,
      depth,
      truncated,
    } = await fallowWalk(root, changed, maxDepth, progress));
    // The file-level walk records no parent, so no chain is claimed for it.
  }

  progress('  collecting health signals');
  const signals = await collectSignals(root, base);
  if (totalProductFiles === 0) {
    totalProductFiles =
      [...signals.scores.keys()].filter((p) => !TEST_PATTERN.test(p)).length ||
      1;
  }

  const score = scoreImpact(
    changed,
    valueRadius,
    typeOnlyRadius,
    totalProductFiles,
    changedLines(root, mergeBase),
    signals,
  );
  progress(
    `  score ${score.total}/100 (${bandFor(score.total).label}) in ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  if (values.json) {
    process.stdout.write(
      JSON.stringify(
        {
          base,
          engine,
          depth,
          truncated,
          changed,
          downstream: valueRadius,
          downstream_type_only: typeOnlyRadius,
          impact: {
            score: score.total,
            band: bandFor(score.total).label,
            components: score.components.map((c) => ({
              name: c.name,
              points: Number(c.points.toFixed(1)),
              max: c.max,
              evidence: c.evidence,
            })),
          },
          fan_in_thresholds: signals.thresholds,
          cycles: signals.cycles,
          boundary_violations: signals.violations,
          boundaries_configured: signals.boundariesConfigured,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    process.stdout.write(
      render(
        changed,
        valueRadius,
        typeOnlyRadius,
        parent,
        score,
        engine,
        truncated,
      ),
    );
  }
}

// Structural types for the checker objects, which the sync API does not ship
// declarations for. Only the members this script touches are named.
interface NodeLike {
  getSourceFile(): { fileName: string };
}
interface DeclarationLike {
  resolve(project: unknown): NodeLike | undefined;
}
interface SymbolLike {
  flags: number;
  declarations?: DeclarationLike[];
}
interface ProjectLike {
  checker: {
    getSymbolAtLocation(node: unknown): SymbolLike | undefined;
    getAliasedSymbol(symbol: SymbolLike): SymbolLike;
  };
  program: {
    getSourceFileNames(): string[];
    getSourceFile(name: string): { statements: any[] } | undefined;
  };
}

main().catch((error: unknown) => {
  // Anything that escapes main is a bug in this script, not a finding about the
  // diff. Report it as one line on stderr rather than an unhandled rejection.
  fail(
    `blast-radius: ${error instanceof Error ? error.message : String(error)}`,
  );
});

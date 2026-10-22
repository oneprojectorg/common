import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import { SENSE_DIR, isRecord, isStringRecord } from './util.ts';

/** One public component of @op/sense, paired with its Storybook story. */
export interface CatalogEntry {
  /** The first `package.json#exports` subpath that points at the file. */
  name: string;
  /** Absolute path of the component module. */
  source: string;
  /** Absolute path of its `*.stories.tsx`. */
  story: string;
  /** The story's `title`, e.g. `Primitives/Button`. */
  title: string;
  /** Export names of the stories, in file order. */
  stories: string[];
  /** Named exports of the component module. */
  exports: string[];
  /** The component's own JSDoc, when it has one. */
  doc: string | null;
}

export interface Catalog {
  /** Subpath (`Button`) → absolute module path, for every component export. */
  subpaths: Record<string, string>;
  entries: CatalogEntry[];
}

export function readCatalog(): Catalog {
  const subpaths = readComponentSubpaths();
  const subpathsByFile = new Map<string, string[]>();
  for (const [subpath, file] of Object.entries(subpaths)) {
    subpathsByFile.set(file, [...(subpathsByFile.get(file) ?? []), subpath]);
  }

  const entries = findStories()
    .map((story) => {
      const source = componentForStory(story, subpathsByFile);
      const name = source ? subpathsByFile.get(source)?.[0] : undefined;
      if (!source || !name) {
        throw new Error(`No package.json export for ${story}`);
      }
      return describe(name, source, story);
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return { subpaths, entries };
}

function readComponentSubpaths(): Record<string, string> {
  const pkg: unknown = JSON.parse(
    readFileSync(resolve(SENSE_DIR, 'package.json'), 'utf8'),
  );
  if (!isRecord(pkg) || !isStringRecord(pkg.exports)) {
    throw new Error('@op/sense package.json has no string exports map');
  }
  const subpaths: Record<string, string> = {};
  for (const [key, target] of Object.entries(pkg.exports)) {
    // `./Button`, `./icons`; not `.`, `./styles.css`, `./lib/*` or `./hooks/*`.
    if (/^\.\/(?:[A-Z][^/]*|icons)$/.test(key)) {
      subpaths[key.slice(2)] = resolve(SENSE_DIR, target);
    }
  }
  return subpaths;
}

function findStories(): string[] {
  return readdirSync(resolve(SENSE_DIR, 'src'), { recursive: true })
    .filter((file) => String(file).endsWith('.stories.tsx'))
    .map((file) => resolve(SENSE_DIR, 'src', String(file)));
}

/** `ui/button.stories.tsx` → `ui/button.tsx`; `X/index.stories.tsx` → `X/index.tsx`. */
function componentForStory(
  story: string,
  subpathsByFile: Map<string, string[]>,
): string | undefined {
  const base = story.replace(/\.stories\.tsx$/, '');
  const candidates = [`${base}.tsx`, `${base}.ts`];
  if (basename(story) === 'index.stories.tsx') {
    candidates.push(resolve(dirname(story), 'index.ts'));
  }
  return candidates.find((file) => subpathsByFile.has(file));
}

function describe(name: string, source: string, story: string): CatalogEntry {
  const code = readFileSync(source, 'utf8');
  const storyCode = readFileSync(story, 'utf8');
  return {
    name,
    source,
    story,
    // The meta's title, not a `title` field in the story's sample data.
    title:
      (/Meta<[\s\S]*?title:\s*'([^']+)'/.exec(storyCode) ??
        /title:\s*'([^']+)'/.exec(storyCode))?.[1] ?? `Components/${name}`,
    stories: [...storyCode.matchAll(/^export const (\w+)/gm)].flatMap((m) =>
      m[1] ? [m[1]] : [],
    ),
    exports: readExports(code),
    doc: readJsDoc(code, name),
  };
}

function readExports(code: string): string[] {
  const names = new Set<string>();
  for (const match of code.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name =
        part
          .trim()
          .split(/\s+as\s+/)
          .pop() ?? '';
      if (name && !name.startsWith('type ')) names.add(name);
    }
  }
  for (const match of code.matchAll(
    /^export (?:function|const|class) (\w+)/gm,
  )) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

/** The JSDoc block directly above `function <name>` / `const <name>`. */
function readJsDoc(code: string, name: string): string | null {
  const match = new RegExp(
    String.raw`/\*\*((?:(?!\*/)[\s\S])*)\*/\s*(?:export\s+)?(?:const|function|class)\s+${name}\b`,
  ).exec(code);
  if (!match?.[1]) return null;
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();
}

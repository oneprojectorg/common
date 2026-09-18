/**
 * Fails when a message's English value changed against a base ref but one of
 * its translations did not.
 *
 *   pnpm i18n:check [<ref>]     defaults to origin/dev; CI passes the PR's base branch
 *
 * Keys are the English text today, so a copy edit already touches every
 * dictionary. ADR 0005 (#2082) moves to ID keys, where an English-only edit
 * would leave the translations silently stale. Key parity and formatting are
 * covered by `dictionaries.test.ts`.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Dictionary = Map<string, string>;

const DICTIONARIES = 'apps/app/src/lib/i18n/dictionaries';

// `git ls-tree` paths are relative to the cwd, so git runs from the repo root.
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trimEnd();

const git = (...args: Array<string>): string =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();

const main = (): void => {
  const base = process.argv[2] ?? 'origin/dev';
  const mergeBase = git('merge-base', base, 'HEAD');

  const locales = readdirSync(join(root, DICTIONARIES))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
  const now = (locale: string): Dictionary =>
    flatten(
      JSON.parse(
        readFileSync(join(root, DICTIONARIES, `${locale}.json`), 'utf8'),
      ),
    );
  // Absent at the base means a new locale; any other failure must throw, or
  // the check would have nothing to compare against and pass silently.
  const atBase = new Set(
    git('ls-tree', '--name-only', mergeBase, `${DICTIONARIES}/`).split('\n'),
  );
  if (!atBase.has(`${DICTIONARIES}/en.json`)) {
    throw new Error(`${DICTIONARIES}/en.json not found at ${mergeBase}`);
  }
  const then = (locale: string): Dictionary =>
    atBase.has(`${DICTIONARIES}/${locale}.json`)
      ? flatten(
          JSON.parse(
            git('show', `${mergeBase}:${DICTIONARIES}/${locale}.json`),
          ),
        )
      : new Map();

  const englishThen = then('en');
  const translations = locales
    .filter((locale) => locale !== 'en')
    .map((locale) => ({ locale, then: then(locale), now: now(locale) }));
  const report: Array<string> = [];

  for (const [key, message] of now('en')) {
    const was = englishThen.get(key);
    if (was === undefined || was === message) {
      continue;
    }
    const unchanged = translations.filter(({ then, now }) => {
      const before = then.get(key);
      return before !== undefined && before === now.get(key);
    });
    if (unchanged.length > 0) {
      report.push(
        `  ${quote(key)}`,
        `    en was: ${quote(was)}`,
        `    en now: ${quote(message)}`,
        ...unchanged.map(({ locale }) => `    unchanged: ${locale}.json`),
      );
    }
  }

  if (report.length > 0) {
    process.stderr.write(
      [
        `Translations left behind by an English copy change (base ${base}, ${mergeBase.slice(0, 9)})`,
        ...report,
        'Update the translations above, then re-run this check.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  process.stdout.write(
    `Dictionaries OK: ${locales.length} locales against ${base}.\n`,
  );
};

/** Nested namespaces flattened to dot-joined paths; flat files pass through. */
const flatten = (value: unknown, prefix = '', into: Dictionary = new Map()) => {
  if (typeof value === 'string') {
    if (into.has(prefix)) {
      throw new Error(`"${prefix}" is both a dotted key and a nested path`);
    }
    into.set(prefix, value);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix === '' ? key : `${prefix}.${key}`, into);
    }
  } else {
    throw new Error(`${prefix || '(root)'} is not a string or an object`);
  }
  return into;
};

const quote = (value: string): string => JSON.stringify(value);

main();

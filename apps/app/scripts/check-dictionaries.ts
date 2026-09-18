/**
 * Checks the message dictionaries in `src/lib/i18n/dictionaries`.
 *
 *   pnpm i18n                     whole-dictionary checks
 *   pnpm i18n:check               the same, plus the diff check against origin/dev
 *   tsx scripts/check-dictionaries.ts [--base <ref>]
 *
 * Whole-dictionary: every locale carries exactly English's keys, and each
 * translation repeats English's `{arguments}` and `<tags>` — a dropped or
 * renamed placeholder renders the raw key, which nothing else catches.
 *
 * Diff (`--base <ref>`): a key whose English value changed must change in
 * every other locale too. Keys are the English source text today, so an edited
 * string already forces all eight files to change; ADR 0005 moves us to ID
 * keys, where an English-only edit would otherwise leave seven translations
 * silently stale. Deliberately strict, with no escape hatch: strict is no
 * worse than the status quo, and an escape hatch is the thing being replaced.
 *
 * Both modes flatten nested objects to dot-joined paths, so they read today's
 * flat files and ADR 0005's namespaced ones alike.
 *
 * This is a CLI whose output is its report, not telemetry, so it writes to
 * stdout/stderr rather than going through `@op/logging`.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

type Dictionary = Map<string, string>;

type Placeholders = { args: Array<string>; tags: Array<string> };

const DEFAULT_LOCALE = 'en';
const DICTIONARY_DIR = join(
  import.meta.dirname,
  '../src/lib/i18n/dictionaries',
);

const main = (): void => {
  const base = parseBase(process.argv.slice(2));
  const locales = localesInDictionaryDir();
  const translated = locales.filter((locale) => locale !== DEFAULT_LOCALE);

  const current = new Map(
    locales.map((locale) => [locale, readDictionary(dictionaryPath(locale))]),
  );
  const english = dictionaryFor(current, DEFAULT_LOCALE);

  const report: Array<string> = [
    ...keyParityReport(english, current, translated),
    ...placeholderReport(english, current, translated),
    ...(base === undefined
      ? []
      : staleTranslationReport(base, locales, translated, current)),
  ];

  if (report.length > 0) {
    process.stderr.write(`${report.join('\n')}`);
    process.stderr.write('Fix the entries above, then re-run this check.\n');
    process.exit(1);
  }

  const scope =
    base === undefined
      ? `${locales.length} dictionaries`
      : `${locales.length} dictionaries against ${base}`;
  process.stdout.write(`Dictionaries OK: ${english.size} keys, ${scope}.\n`);
};

// --- checks ----------------------------------------------------------------

/** Every locale carries exactly English's key set. */
const keyParityReport = (
  english: Dictionary,
  current: Map<string, Dictionary>,
  translated: Array<string>,
): Array<string> => {
  const lines: Array<string> = [];

  for (const locale of translated) {
    const messages = dictionaryFor(current, locale);
    const missing = [...english.keys()].filter((key) => !messages.has(key));
    const stale = [...messages.keys()].filter((key) => !english.has(key));

    if (missing.length === 0 && stale.length === 0) {
      continue;
    }
    lines.push(`  ${locale}.json`);
    for (const key of missing.sort()) {
      lines.push(`    missing: ${quote(key)}`);
    }
    for (const key of stale.sort()) {
      lines.push(`    stale:   ${quote(key)}`);
    }
  }

  return lines.length === 0 ? [] : ['Key parity', ...lines, ''];
};

/** Each translation repeats English's ICU arguments and rich-text tags. */
const placeholderReport = (
  english: Dictionary,
  current: Map<string, Dictionary>,
  translated: Array<string>,
): Array<string> => {
  const lines: Array<string> = [];

  for (const [key, source] of english) {
    const expected = placeholdersIn(source);
    const offenders: Array<string> = [];

    for (const locale of translated) {
      const message = dictionaryFor(current, locale).get(key);
      if (message === undefined) {
        continue; // Key parity reports it; nothing to compare against.
      }
      const found = placeholdersIn(message);
      const argDiff = describeDifference(expected.args, found.args, '{', '}');
      const tagDiff = describeDifference(expected.tags, found.tags, '<', '>');
      if (argDiff === undefined && tagDiff === undefined) {
        continue;
      }
      offenders.push(
        `    ${locale}: ${[argDiff, tagDiff].filter(Boolean).join('; ')}`,
      );
      offenders.push(`      ${quote(message)}`);
    }

    if (offenders.length > 0) {
      lines.push(`  ${quote(key)}`, `    en: ${quote(source)}`, ...offenders);
    }
  }

  return lines.length === 0 ? [] : ['Placeholder parity', ...lines, ''];
};

/**
 * A key whose English value changed between `base` and the working tree must
 * have changed in every other locale too.
 */
const staleTranslationReport = (
  base: string,
  locales: Array<string>,
  translated: Array<string>,
  current: Map<string, Dictionary>,
): Array<string> => {
  const mergeBase = git(['merge-base', base, 'HEAD']);
  const atBase = new Map(
    locales.map((locale) => [
      locale,
      readDictionaryAt(mergeBase, dictionaryPath(locale)),
    ]),
  );
  const englishBase = dictionaryFor(atBase, DEFAULT_LOCALE);
  const englishNow = dictionaryFor(current, DEFAULT_LOCALE);
  const lines: Array<string> = [];

  for (const [key, message] of englishNow) {
    const was = englishBase.get(key);
    // A key English added is new everywhere; key parity covers it.
    if (was === undefined || was === message) {
      continue;
    }

    const unchanged = translated.filter((locale) => {
      const before = dictionaryFor(atBase, locale).get(key);
      const after = dictionaryFor(current, locale).get(key);
      return before !== undefined && after !== undefined && before === after;
    });

    if (unchanged.length > 0) {
      lines.push(
        `  ${quote(key)}`,
        `    en was: ${quote(was)}`,
        `    en now: ${quote(message)}`,
        ...unchanged.map((locale) => `    unchanged: ${locale}.json`),
      );
    }
  }

  return lines.length === 0
    ? []
    : [
        `Translations left behind by an English copy change (base ${base}, ${mergeBase.slice(0, 9)})`,
        ...lines,
        '',
      ];
};

// --- placeholders ----------------------------------------------------------

/**
 * The `{name}` arguments and `<tag>` names a message references. Same regexes
 * as `dictionaries.test.ts`: over-matching a single-word plural arm is
 * harmless here because both sides of the comparison over-match alike.
 */
const placeholdersIn = (message: string): Placeholders => ({
  args: unique(
    [...message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map(
      (match) => match[1] ?? '',
    ),
  ),
  tags: unique(
    [...message.matchAll(/<([A-Za-z][A-Za-z0-9]*)>/g)].map(
      (match) => match[1] ?? '',
    ),
  ),
});

const describeDifference = (
  expected: Array<string>,
  found: Array<string>,
  open: string,
  close: string,
): string | undefined => {
  const missing = expected.filter((name) => !found.includes(name));
  const extra = found.filter((name) => !expected.includes(name));
  if (missing.length === 0 && extra.length === 0) {
    return undefined;
  }
  const wrap = (names: Array<string>): string =>
    names.map((name) => `${open}${name}${close}`).join(' ');
  return [
    missing.length > 0 ? `missing ${wrap(missing)}` : '',
    extra.length > 0 ? `unexpected ${wrap(extra)}` : '',
  ]
    .filter(Boolean)
    .join(', ');
};

// --- dictionaries ----------------------------------------------------------

const dictionaryPath = (locale: string): string =>
  join(DICTIONARY_DIR, `${locale}.json`);

/**
 * Every `.json` in the dictionary directory is a supported locale, English
 * first. Read from disk rather than `i18nConfig`, which pulls in `@op/common`.
 */
const localesInDictionaryDir = (): Array<string> => {
  const locales = readdirSync(DICTIONARY_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
  if (!locales.includes(DEFAULT_LOCALE)) {
    fail(`No ${DEFAULT_LOCALE}.json in ${DICTIONARY_DIR}`);
  }
  return locales;
};

const readDictionary = (path: string): Dictionary =>
  flatten(parseJson(readFileSync(path, 'utf8'), path), path);

/** The dictionary as of `sha`; an absent file means every key is new. */
const readDictionaryAt = (sha: string, path: string): Dictionary => {
  const repoPath = relative(git(['rev-parse', '--show-toplevel']), path);
  try {
    const json = git(['show', `${sha}:${repoPath}`]);
    return flatten(parseJson(json, `${sha}:${repoPath}`), repoPath);
  } catch {
    return new Map();
  }
};

/** Nested namespaces flattened to dot-joined paths; flat files pass through. */
const flatten = (
  value: unknown,
  source: string,
  prefix = '',
  into: Dictionary = new Map(),
): Dictionary => {
  if (typeof value === 'string') {
    into.set(prefix, value);
    return into;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, source, prefix === '' ? key : `${prefix}.${key}`, into);
    }
    return into;
  }
  return fail(`${source}: ${prefix || '(root)'} is not a string or an object`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const dictionaryFor = (
  dictionaries: Map<string, Dictionary>,
  locale: string,
): Dictionary => dictionaries.get(locale) ?? new Map();

const parseJson = (json: string, source: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed;
  } catch (error) {
    return fail(`${source}: ${error instanceof Error ? error.message : error}`);
  }
};

// --- plumbing --------------------------------------------------------------

const parseBase = (argv: Array<string>): string | undefined => {
  let base: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else if (arg === '--base') {
      index += 1;
      base = argv[index];
    } else {
      fail(`Unknown argument ${arg}\nUsage: check-dictionaries [--base <ref>]`);
    }
    if (base === undefined || base === '') {
      fail('--base needs a git ref, e.g. --base origin/dev');
    }
  }

  return base;
};

const git = (args: Array<string>): string =>
  execFileSync('git', args, {
    cwd: DICTIONARY_DIR,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();

const unique = (names: Array<string>): Array<string> =>
  [...new Set(names)].sort();

const quote = (value: string): string => JSON.stringify(value);

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

main();

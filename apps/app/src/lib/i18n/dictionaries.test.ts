import { createTranslator } from 'next-intl';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { i18nConfig } from './config';
import english from './dictionaries/en.json';
import type { MessageTree } from './messageKeys';
import { normalizeMessageKeys } from './messageKeys';
import { withNormalizedKeys } from './translate';

type MessageValues = Record<
  string,
  number | ((chunks: ReactNode) => ReactNode)
>;

/** One message and where it lives in the file. */
interface Leaf {
  /** Dot-joined path, as `TranslationKey` spells it. */
  path: string;
  message: string;
}

// Every `{name}` argument and `<tag>` a message references, so it can be
// formatted without knowing its placeholders up front. Over-matching (a
// single-word plural arm) only adds an unused value, which formats fine.
const argumentsIn = (message: string): MessageValues => ({
  ...Object.fromEntries(
    [...message.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map((match) => [
      match[1],
      1,
    ]),
  ),
  ...Object.fromEntries(
    [...message.matchAll(/<([A-Za-z][A-Za-z0-9]*)>/g)].map((match) => [
      match[1],
      (chunks: ReactNode) => chunks,
    ]),
  ),
});

/** Every message in a dictionary, flattened to the path its call sites use. */
const leavesOf = (
  tree: MessageTree,
  prefix: Array<string> = [],
  into: Array<Leaf> = [],
): Array<Leaf> => {
  for (const [key, value] of Object.entries(tree)) {
    const path = [...prefix, key];

    if (typeof value === 'string') {
      into.push({ path: path.join('.'), message: value });
    } else {
      leavesOf(value, path, into);
    }
  }

  return into;
};

const englishTree: MessageTree = english;
const englishMessages = new Map(
  leavesOf(englishTree).map((leaf) => [leaf.path, leaf.message]),
);

const dictionaryPath = (locale: string): string =>
  join(import.meta.dirname, 'dictionaries', `${locale}.json`);

const dictionaryOf = (locale: string): MessageTree =>
  JSON.parse(readFileSync(dictionaryPath(locale), 'utf8'));

const translatedLocales = i18nConfig.locales.filter(
  (locale) => locale !== i18nConfig.defaultLocale,
);

// Every key declared in the file, as a dot-joined path, duplicates included.
// `JSON.parse` can't answer this — by the time a reviver runs, a repeated key
// has already overwritten its earlier twin. Our dictionaries are
// machine-formatted JSON, one entry per line with a two-space indent, and a
// JSON string can't hold a literal newline, so the indent gives the depth and
// the enclosing keys give the path.
const declaredPathsOf = (json: string): Array<string> => {
  const paths: Array<string> = [];
  const enclosing: Array<string> = [];

  for (const line of json.split('\n')) {
    const entry = line.match(/^( +)"((?:[^"\\]|\\.)*)":\s*(\{?)/);

    if (!entry) {
      continue;
    }

    const depth = (entry[1]?.length ?? 0) / 2 - 1;
    const key = String(JSON.parse(`"${entry[2]}"`));

    enclosing.length = depth;
    paths.push([...enclosing, key].join('.'));

    if (entry[3] === '{') {
      enclosing[depth] = key;
    }
  }

  return paths;
};

/** The same paths, taken from the parsed file, so the scan above can be checked. */
const parsedPathsOf = (tree: MessageTree, prefix = ''): Array<string> =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;

    return typeof value === 'string'
      ? [path]
      : [path, ...parsedPathsOf(value, path)];
  });

// `request.ts` resolves a dictionary with a dynamic import keyed on the locale
// and hands it to next-intl untouched, so a supported locale whose dictionary
// is missing — or holds a message next-intl can't format — fails at request
// time, for every page in that locale. A message that fails to format renders
// as its raw key, which is easy to miss in review.
//
// Values come from the English message, not the translated one: the call site
// passes what the English key implies, so a translation that renamed a
// placeholder formats here exactly as badly as it would in the browser.
describe('dictionaries', () => {
  it.each(i18nConfig.locales)('formats every %s message', (locale) => {
    const messages = dictionaryOf(locale);
    const failures: Array<string> = [];
    // Through the wrapper, so each message is read exactly as a call site
    // reads it: a legacy key by its substituted form, a namespaced one by path.
    const t = withNormalizedKeys<string>(
      createTranslator({
        locale,
        messages: normalizeMessageKeys(messages),
        onError: (error) => failures.push(error.message),
      }),
    );

    const leaves = leavesOf(messages);
    expect(leaves.length).toBeGreaterThan(0);

    for (const leaf of leaves) {
      // rich() rather than t(): it handles both plain and tag-bearing messages.
      t.rich(
        leaf.path,
        argumentsIn(englishMessages.get(leaf.path) ?? leaf.message),
      );
    }

    expect(failures).toEqual([]);
  });

  // `TranslationKey` is derived from `en.json` alone, so English is the only
  // dictionary the compiler checks. A key added there and forgotten elsewhere
  // type-checks, ships, and renders the raw key to everyone on that locale,
  // while `request.ts` logs an error per miss. Compared as sets: the
  // dictionaries are not ordered alike, and needn't be.
  it.each(translatedLocales)('translates every English key in %s', (locale) => {
    const englishKeys = new Set(englishMessages.keys());
    const localeKeys = new Set(
      leavesOf(dictionaryOf(locale)).map((leaf) => leaf.path),
    );

    expect({
      untranslated: [...englishKeys]
        .filter((key) => !localeKeys.has(key))
        .sort(),
      // The mirror image: a key English dropped or reworded. Harmless at
      // runtime, but it hides real drift behind a matching total.
      stale: [...localeKeys].filter((key) => !englishKeys.has(key)).sort(),
    }).toEqual({ untranslated: [], stale: [] });
  });

  // A repeated key is valid JSON, so nothing upstream complains: the last one
  // silently wins and its twin's translation is simply lost. A namespace makes
  // this cheaper to hit, since two IDs only have to collide inside it.
  it.each(i18nConfig.locales)('declares every %s key once', (locale) => {
    const declared = declaredPathsOf(
      readFileSync(dictionaryPath(locale), 'utf8'),
    );
    const seen = new Set<string>();
    const duplicated = new Set<string>();

    for (const path of declared) {
      if (seen.has(path)) {
        duplicated.add(path);
      }
      seen.add(path);
    }

    expect([...duplicated].sort()).toEqual([]);
    // Guards the scan above: if the dictionaries stop being one-entry-per-line
    // with a two-space indent, it would quietly match nothing or the wrong
    // depth, and this test would pass without checking.
    expect([...seen].sort()).toEqual(
      parsedPathsOf(dictionaryOf(locale)).sort(),
    );
  });

  // ADR 0005: a namespace name and an ID never hold a period, because next-intl
  // reads one as a path separator. Only the legacy top-level keys may, and PR 8
  // of the migration removes the last of them along with the substitution that
  // makes them work.
  it.each(i18nConfig.locales)('keys no %s message by a dotted ID', (locale) => {
    expect(dottedIdsIn(dictionaryOf(locale))).toEqual([]);
  });
});

/**
 * Namespace names and IDs that hold a period. A legacy top-level message —
 * a string keyed by its English text — is exempt: those are what the
 * substitution in `messageKeys.ts` exists for.
 */
const dottedIdsIn = (
  tree: MessageTree,
  prefix: Array<string> = [],
): Array<string> =>
  Object.entries(tree).flatMap(([key, value]) => {
    const isLegacyTopLevelKey =
      prefix.length === 0 && typeof value === 'string';
    const path = [...prefix, key];
    const offender =
      key.includes('.') && !isLegacyTopLevelKey ? [path.join(' → ')] : [];

    return typeof value === 'string'
      ? offender
      : [...offender, ...dottedIdsIn(value, path)];
  });

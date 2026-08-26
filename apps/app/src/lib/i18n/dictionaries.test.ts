import { createTranslator } from 'next-intl';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { i18nConfig } from './config';
import english from './dictionaries/en.json';
import { normalizeMessageKey, normalizeMessageKeys } from './messageKeys';

type MessageValues = Record<
  string,
  number | ((chunks: ReactNode) => ReactNode)
>;

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

const englishMessages: Record<string, string> = english;

const dictionaryPath = (locale: string): string =>
  join(import.meta.dirname, 'dictionaries', `${locale}.json`);

const translatedLocales = i18nConfig.locales.filter(
  (locale) => locale !== i18nConfig.defaultLocale,
);

// The top-level keys as they appear in the file, duplicates included. `JSON.parse`
// can't answer this — by the time a reviver runs, a repeated key has already
// overwritten its earlier twin. Our dictionaries are machine-formatted flat JSON,
// one entry per line, and a JSON string can't hold a literal newline, so the
// leading two-space indent identifies a top-level key unambiguously.
const declaredKeysOf = (json: string): Array<string> =>
  [...json.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":/gm)].map((match) =>
    String(JSON.parse(`"${match[1]}"`)),
  );

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
  it.each(i18nConfig.locales)('formats every %s message', async (locale) => {
    const messages: Record<string, string> = (
      await import(`./dictionaries/${locale}.json`)
    ).default;
    const failures: Array<string> = [];
    const t = createTranslator({
      locale,
      messages: normalizeMessageKeys(messages),
      onError: (error) => failures.push(error.message),
    });

    const entries = Object.entries(messages);
    expect(entries.length).toBeGreaterThan(0);

    for (const [key, message] of entries) {
      // rich() rather than t(): it handles both plain and tag-bearing messages.
      t.rich(
        normalizeMessageKey(key),
        argumentsIn(englishMessages[key] ?? message),
      );
    }

    expect(failures).toEqual([]);
  });

  // `TranslationKey` in `routing.tsx` is derived from `en.json` alone, so English
  // is the only dictionary the compiler checks. A key added there and forgotten
  // elsewhere type-checks, ships, and renders the raw key — the English source
  // string — to everyone on that locale, while `request.ts` logs an error per
  // miss. Compared as sets: the dictionaries are not ordered alike, and needn't be.
  it.each(translatedLocales)(
    'translates every English key in %s',
    async (locale) => {
      const messages: Record<string, string> = (
        await import(`./dictionaries/${locale}.json`)
      ).default;

      const englishKeys = new Set(Object.keys(englishMessages));
      const localeKeys = new Set(Object.keys(messages));

      expect({
        untranslated: [...englishKeys]
          .filter((key) => !localeKeys.has(key))
          .sort(),
        // The mirror image: a key English dropped or reworded. Harmless at runtime,
        // but it hides real drift behind a matching total.
        stale: [...localeKeys].filter((key) => !englishKeys.has(key)).sort(),
      }).toEqual({ untranslated: [], stale: [] });
    },
  );

  // A repeated key is valid JSON, so nothing upstream complains: the last one
  // silently wins and its twin's translation is simply lost.
  it.each(i18nConfig.locales)('declares every %s key once', (locale) => {
    const json = readFileSync(dictionaryPath(locale), 'utf8');
    const declared = declaredKeysOf(json);
    const seen = new Set<string>();
    const duplicated = new Set<string>();

    for (const key of declared) {
      if (seen.has(key)) {
        duplicated.add(key);
      }
      seen.add(key);
    }

    expect([...duplicated].sort()).toEqual([]);
    // Guards the scan above: if the dictionaries stop being one-entry-per-line,
    // it would quietly match nothing and this test would pass without checking.
    expect(seen).toEqual(new Set(Object.keys(JSON.parse(json))));
  });
});

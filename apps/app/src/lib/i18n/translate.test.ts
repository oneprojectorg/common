import { createTranslator } from 'next-intl';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import english from './dictionaries/en.json';
import hungarian from './dictionaries/hu.json';
import { normalizeMessageKeys } from './messageKeys';
import type { TranslationKey } from './translate';
import { withNormalizedKeys } from './translate';

const englishMessages: Record<string, string> = english;
const hungarianMessages: Record<string, string> = hungarian;

// The real dictionaries are the fixture: a stand-in would let the wrapper pass
// against keys ours don't look like. Hungarian is an arbitrary non-default
// locale — English can't show this bug, since the key echoed back on a miss IS
// the English message.
const translateHungarian = () =>
  withNormalizedKeys(
    createTranslator({
      locale: 'hu',
      messages: normalizeMessageKeys(hungarianMessages),
      // A miss must surface as the fallback asserted below, not as a throw.
      onError: () => {},
    }),
  );

// Placeholder-free so the assertion compares a lookup, not a formatting result.
const plainKeysWithAPeriod = Object.keys(englishMessages).filter(
  (key) => key.includes('.') && !/[{<]/.test(englishMessages[key] ?? ''),
);

describe('withNormalizedKeys', () => {
  it('finds a message whose key contains a period', () => {
    const t = translateHungarian();
    const key = 'Check your connection and try again.' satisfies TranslationKey;

    expect(t(key)).toBe(hungarianMessages[key]);
  });

  // The regression this file exists for. In English the missed-key fallback is
  // indistinguishable from a hit, which is why it survived; every other locale
  // renders English instead.
  it('finds every message whose key contains a period', () => {
    const t = translateHungarian();

    expect(plainKeysWithAPeriod.length).toBeGreaterThan(0);
    expect(
      plainKeysWithAPeriod.filter(
        (key) => t(key as TranslationKey) !== hungarianMessages[key],
      ),
    ).toEqual([]);
  });

  it('falls back to the source key rather than to its lookup form', () => {
    const t = translateHungarian();
    // Absent from every dictionary, and dotted, so a leaked lookup form shows.
    const missing = 'Nothing here. Nothing there.' as TranslationKey;

    expect(t(missing)).toBe(missing);
    expect(t.has(missing)).toBe(false);
  });

  it('formats tags and values under a key containing a period', () => {
    const t = translateHungarian();
    const key =
      "You've invited <bold>{email}</bold> to join <bold>{organization}</bold>." satisfies TranslationKey;

    expect(
      t.markup(key, {
        bold: (chunks: string) => `<b>${chunks}</b>`,
        email: 'ada@example.com',
        organization: 'Common',
      }),
    ).toContain('<b>ada@example.com</b>');
  });
});

// A wrapper only helps where it is used, and `next-intl/server` exports the
// unwrapped `getTranslations`. Reaching for it directly reintroduces the bug
// silently — every key without a period keeps working.
describe('server translations', () => {
  it('are imported from this module, never from next-intl/server', () => {
    const sourceRoot = join(import.meta.dirname, '..', '..');
    const wrapper = join(sourceRoot, 'lib', 'i18n', 'server.ts');

    const offenders = sourceFilesIn(sourceRoot)
      .filter((file) => file !== wrapper)
      .filter((file) => importsGetTranslations(readFileSync(file, 'utf8')))
      .map((file) => relative(sourceRoot, file));

    expect(offenders).toEqual([]);
  });
});

const sourceFilesIn = (directory: string): Array<string> =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return sourceFilesIn(path);
    }

    return /\.tsx?$/.test(path) ? [path] : [];
  });

// `request.ts` legitimately imports `getRequestConfig` from the same module, so
// the binding matters, not the specifier.
const importsGetTranslations = (source: string): boolean =>
  [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'next-intl\/server'/g)]
    .flatMap((match) => (match[1] ?? '').split(','))
    .some((binding) => binding.trim().split(/\s+/)[0] === 'getTranslations');

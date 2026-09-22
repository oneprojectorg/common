import { createTranslator } from 'next-intl';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import english from './dictionaries/en.json';
import hungarian from './dictionaries/hu.json';
import type { MessageTree } from './messageKeys';
import { normalizeMessageKeys } from './messageKeys';
import type {
  LeafPaths,
  NamespacePaths,
  Subtree,
  TranslationKey,
} from './translate';
import { withNormalizedKeys } from './translate';

// The dictionaries hold namespace objects beside the legacy flat labels
// (ADR 0005), so they are trees, not string maps.
const englishMessages: MessageTree = english;
const hungarianMessages: MessageTree = hungarian;

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
// Only the top-level entries are legacy keys; a namespace object has no period
// in its name and its leaves are addressed as a path.
const plainKeysWithAPeriod = Object.entries(englishMessages)
  .filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' &&
      entry[0].includes('.') &&
      !/[{<]/.test(entry[1]),
  )
  .map(([key]) => key);

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

  // A namespaced key is a real path into the dictionary, so the substitution
  // must not touch it. Both forms have to resolve from the same translator,
  // which is the whole job of this layer until PR 8 of ADR 0005's migration
  // retires the flat keys.
  it('resolves a namespace path verbatim and a legacy key through the substitution', () => {
    const t = withNormalizedKeys<'onboarding.fullName' | 'Please try again.'>(
      createTranslator({
        locale: 'hu',
        messages: normalizeMessageKeys({
          'Please try again.': 'Probalja ujra.',
          onboarding: { fullName: 'Teljes nev' },
        }),
        onError: () => {},
      }),
    );

    expect(t('onboarding.fullName')).toBe('Teljes nev');
    expect(t('Please try again.')).toBe('Probalja ujra.');
    expect(t.has('onboarding.fullName')).toBe(true);
    expect(t.has('Please try again.')).toBe(true);
  });

  it('scopes a translator to a namespace', () => {
    const t = withNormalizedKeys<'fullName'>(
      createTranslator({
        locale: 'hu',
        messages: normalizeMessageKeys({
          onboarding: { fullName: 'Teljes nev' },
        }),
        namespace: 'onboarding',
        onError: () => {},
      }),
    );

    expect(t('fullName')).toBe('Teljes nev');
  });

  // Tags and values have to survive the substitution, on a legacy key and on a
  // namespace path alike. The messages are inline: keyed on a real dictionary
  // entry, this test broke every time the migration moved that entry.
  it('formats tags and values under a legacy key and under a namespace path', () => {
    const t = withNormalizedKeys<'Merge <b>{name}</b>.' | 'decisions.merge'>(
      createTranslator({
        locale: 'hu',
        messages: normalizeMessageKeys({
          'Merge <b>{name}</b>.': '<b>{name}</b> osszevonasa.',
          decisions: { merge: '<b>{name}</b> osszevonasa.' },
        }),
        onError: () => {},
      }),
    );
    const values = {
      b: (chunks: string) => `<strong>${chunks}</strong>`,
      name: 'Bike lanes',
    };

    expect(t.markup('Merge <b>{name}</b>.', values)).toContain(
      '<strong>Bike lanes</strong>',
    );
    expect(t.markup('decisions.merge', values)).toContain(
      '<strong>Bike lanes</strong>',
    );
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

// The type layer carries the same distinction as the lookup above, against a
// fixture rather than the real dictionary: `en.json` holds no namespace yet,
// so nothing here would be exercised by the live types until PR 2 lands.
interface FixtureTree {
  Cancel: string;
  'Please try again.': string;
  onboarding: { fullName: string };
  decisions: { processBuilder: { addPhase: string } };
}

type Expect<Assertion extends true> = Assertion;
type Equals<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
    ? true
    : false;

export type LeavesAreDottedPaths = Expect<
  Equals<
    LeafPaths<FixtureTree>,
    | 'Cancel'
    | 'Please try again.'
    | 'onboarding.fullName'
    | 'decisions.processBuilder.addPhase'
  >
>;

export type NamespacesAreTheObjects = Expect<
  Equals<
    NamespacePaths<FixtureTree>,
    'onboarding' | 'decisions' | 'decisions.processBuilder'
  >
>;

export type KeysAreRelativeToTheNamespace = Expect<
  Equals<
    LeafPaths<Subtree<FixtureTree, 'decisions.processBuilder'>>,
    'addPhase'
  >
>;

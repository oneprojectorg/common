import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import type { KeysIn, LeafPaths, NamespacePaths, Subtree } from './translate';

// A fixture rather than the real dictionary: these helpers describe the shape
// ADR 0005 asks for — shared labels at the top level, feature copy under a
// namespace — and a test keyed on live messages breaks whenever copy moves.
interface FixtureTree {
  Cancel: string;
  somethingWentWrong: string;
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
    | 'somethingWentWrong'
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

// `KeysIn` is what a scoped translator's keys are typed against, so an
// undefined namespace has to mean "every key", not "no key".
export type UnscopedKeysAreEveryLeaf = Expect<
  Equals<KeysIn<undefined>, LeafPaths<typeof import('./dictionaries/en.json')>>
>;

// The behaviour the types describe, exercised once against next-intl itself:
// a namespace is a real path, and a scoped translator reads keys relative to
// it. Nothing rewrites a key on the way through any more.
describe('scoped translations', () => {
  it('reads a namespaced message by its ID', () => {
    const t = createTranslator({
      locale: 'hu',
      messages: { onboarding: { fullName: 'Teljes nev' } },
      namespace: 'onboarding',
      onError: () => {},
    });

    expect(t('fullName')).toBe('Teljes nev');
  });

  it('reads the same message by its full path from an unscoped translator', () => {
    const t = createTranslator({
      locale: 'hu',
      messages: { onboarding: { fullName: 'Teljes nev' } },
      onError: () => {},
    });

    expect(t('onboarding.fullName')).toBe('Teljes nev');
  });
});

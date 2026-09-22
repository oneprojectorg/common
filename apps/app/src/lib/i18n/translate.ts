import type { ReactNode } from 'react';

import type messages from './dictionaries/en.json';
import { normalizeMessageKey } from './messageKeys';

type Dictionary = typeof messages;

/**
 * Dot-joined path of every string in `Tree`. A dictionary holds top-level
 * labels keyed by their English text and namespace objects keyed by ID
 * (ADR 0005), so the leaves are what a call site may ask for.
 */
export type LeafPaths<Tree> = {
  [Key in keyof Tree & string]: Tree[Key] extends string
    ? Key
    : `${Key}.${LeafPaths<Tree[Key]>}`;
}[keyof Tree & string];

/** Dot-joined path of every object in `Tree` — the namespaces a caller may scope to. */
export type NamespacePaths<Tree> = {
  [Key in keyof Tree & string]: Tree[Key] extends string
    ? never
    : Key | `${Key}.${NamespacePaths<Tree[Key]>}`;
}[keyof Tree & string];

/** The part of `Tree` a namespace path addresses. */
export type Subtree<
  Tree,
  Path extends string,
> = Path extends `${infer Head}.${infer Rest}`
  ? Head extends keyof Tree
    ? Subtree<Tree[Head], Rest>
    : never
  : Path extends keyof Tree
    ? Tree[Path]
    : never;

/**
 * Union of all known translation keys derived from the English dictionary.
 * English serves as the canonical source of truth — other language dictionaries
 * must contain the same keys.
 */
export type TranslationKey = LeafPaths<Dictionary>;

/** Union of the namespaces `useTranslations` and `getTranslations` accept. */
export type MessageNamespace = NamespacePaths<Dictionary>;

/** The keys a translator scoped to `Namespace` accepts, relative to it. */
export type KeysIn<Namespace extends MessageNamespace | undefined> =
  Namespace extends MessageNamespace
    ? LeafPaths<Subtree<Dictionary, Namespace>>
    : TranslationKey;

/**
 * Typed translation function returned by `useTranslations()` and
 * `getTranslations()`. `Key` is the dictionary's leaf paths, or the leaf paths
 * below a namespace when the caller scoped the translator to one.
 *
 * Only accepts a known key — typos and missing keys are caught at compile
 * time (no runtime enforcement). For dynamic keys (e.g. template field labels
 * from the database), cast with `as TranslationKey` to bypass the check.
 *
 * Values are typed as optional `Record<string, unknown>` because this custom
 * interface flattens all keys into a single union, which discards the per-key
 * value inference that next-intl normally provides.
 */
export interface TranslateFn<Key extends string = TranslationKey> {
  (key: Key, values?: Record<string, unknown>): string;
  rich(key: Key, values?: Record<string, unknown>): ReactNode;
  markup(key: Key, values?: Record<string, unknown>): string;
  raw(key: Key): unknown;
  has(key: Key): boolean;
}

/**
 * A next-intl translator addressed by lookup key rather than by source key.
 * next-intl types its keys from the dictionary, which still keys legacy
 * messages by the English source string, so it will not accept the
 * underscored form we look those up by.
 */
interface MessageLookup {
  (key: string, values?: Record<string, unknown>): string;
  rich(key: string, values?: Record<string, unknown>): ReactNode;
  markup(key: string, values?: Record<string, unknown>): string;
  raw(key: string): unknown;
  has(key: string): boolean;
}

/**
 * Applies the substitution `request.ts` applied to the dictionary, so a legacy
 * key containing a period resolves. Every entry point handing out a `t` comes
 * through here — next-intl looks keys up verbatim, and a period in a key it
 * did not rewrite reads as a path separator and misses.
 *
 * A namespaced key (`decisions.processBuilder.addPhase`) is a real path and
 * must not be rewritten, so the verbatim key is tried first: it resolves for a
 * namespace path and for any key without a period, and misses for a legacy
 * key whose periods the dictionary replaced.
 */
export const withNormalizedKeys = <Key extends string = TranslationKey>(
  translator: object,
): TranslateFn<Key> => {
  // One cast for the key-type mismatch `MessageLookup` describes.
  const lookUp = translator as unknown as MessageLookup;

  const readMessage = <Result>(
    key: Key,
    read: (lookupKey: string) => Result,
  ): Result | Key => {
    const lookupKey = lookUp.has(key) ? key : normalizeMessageKey(key);
    const message = read(lookupKey);

    // next-intl echoes back the key it looked up when the message is missing.
    // Fall back to the source key: it reads as the sentence it is, the lookup
    // form does not.
    return message === lookupKey ? key : message;
  };

  return Object.assign(
    (key: Key, values?: Record<string, unknown>) =>
      readMessage(key, (lookupKey) => lookUp(lookupKey, values)),
    {
      rich: (key: Key, values?: Record<string, unknown>) =>
        readMessage(key, (lookupKey) => lookUp.rich(lookupKey, values)),
      markup: (key: Key, values?: Record<string, unknown>) =>
        readMessage(key, (lookupKey) => lookUp.markup(lookupKey, values)),
      raw: (key: Key) => readMessage(key, (lookupKey) => lookUp.raw(lookupKey)),
      // A miss is the answer here rather than something to fall back from.
      has: (key: Key) =>
        lookUp.has(key) || lookUp.has(normalizeMessageKey(key)),
    },
  );
};

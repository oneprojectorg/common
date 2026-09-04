import type { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type messages from './dictionaries/en.json';
import { normalizeMessageKey } from './messageKeys';

/**
 * Union of all known translation keys derived from the English dictionary.
 * English serves as the canonical source of truth — other language dictionaries
 * must contain the same keys.
 */
export type TranslationKey = keyof typeof messages;

/**
 * Typed translation function returned by `useTranslations()` and
 * `getTranslations()`.
 *
 * Only accepts `TranslationKey` — typos and missing keys are caught at compile
 * time (no runtime enforcement). For dynamic keys (e.g. template field labels
 * from the database), cast with `as TranslationKey` to bypass the check.
 *
 * Values are typed as optional `Record<string, unknown>` because this custom
 * interface flattens all keys into a single `TranslationKey` union, which
 * discards the per-key value inference that next-intl normally provides.
 */
export interface TranslateFn {
  (key: TranslationKey, values?: Record<string, unknown>): string;
  rich(key: TranslationKey, values?: Record<string, unknown>): ReactNode;
  markup(key: TranslationKey, values?: Record<string, unknown>): string;
  raw(key: TranslationKey): unknown;
  has(key: TranslationKey): boolean;
}

/**
 * A next-intl translator addressed by lookup key rather than by source key.
 * next-intl types its keys from the dictionary, which we key by the English
 * source string, so it will not accept the underscored form we look up.
 */
interface MessageLookup {
  (key: string, values?: Record<string, unknown>): string;
  rich(key: string, values?: Record<string, unknown>): ReactNode;
  markup(key: string, values?: Record<string, unknown>): string;
  raw(key: string): unknown;
  has(key: string): boolean;
}

/**
 * Applies the substitution `request.ts` applied to the dictionary, so a key
 * containing a period resolves. Every entry point handing out a `t` comes
 * through here — next-intl looks keys up verbatim, and a period in a key it
 * did not rewrite reads as a path separator and misses.
 */
export const withNormalizedKeys = (
  translator: ReturnType<typeof useTranslations>,
): TranslateFn => {
  // One cast for the key-type mismatch `MessageLookup` describes.
  const lookUp = translator as unknown as MessageLookup;

  return Object.assign(
    (key: TranslationKey, values?: Record<string, unknown>) =>
      readMessage(key, (lookupKey) => lookUp(lookupKey, values)),
    {
      rich: (key: TranslationKey, values?: Record<string, unknown>) =>
        readMessage(key, (lookupKey) => lookUp.rich(lookupKey, values)),
      markup: (key: TranslationKey, values?: Record<string, unknown>) =>
        readMessage(key, (lookupKey) => lookUp.markup(lookupKey, values)),
      raw: (key: TranslationKey) =>
        readMessage(key, (lookupKey) => lookUp.raw(lookupKey)),
      // A miss is the answer here rather than something to fall back from.
      has: (key: TranslationKey) => lookUp.has(normalizeMessageKey(key)),
    },
  );
};

/**
 * next-intl echoes back the key it looked up when the message is missing. Fall
 * back to the source key: it reads as the sentence it is, the lookup form does
 * not.
 */
const readMessage = <Result>(
  key: TranslationKey,
  read: (lookupKey: string) => Result,
): Result | string => {
  const lookupKey = normalizeMessageKey(key);
  const message = read(lookupKey);

  return message === lookupKey ? key : message;
};

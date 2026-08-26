import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { i18nConfig } from './config';
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

// `request.ts` resolves a dictionary with a dynamic import keyed on the locale
// and hands it to next-intl untouched, so a supported locale whose dictionary
// is missing — or holds a message next-intl can't format — fails at request
// time, for every page in that locale. A message that fails to format renders
// as its raw key, which is easy to miss in review.
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
      t.rich(normalizeMessageKey(key), argumentsIn(message));
    }

    expect(failures).toEqual([]);
  });
});

import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { i18nConfig } from './config';

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

const loadMessages = async (locale: string): Promise<Record<string, string>> =>
  (await import(`./dictionaries/${locale}.json`)).default;

// `request.ts` resolves a dictionary with a dynamic import keyed on the locale,
// so a supported locale with no dictionary file only fails at request time —
// for every page in that locale. Catch it here instead.
describe('dictionaries', () => {
  it.each(i18nConfig.locales)('has a dictionary for %s', async (locale) => {
    const messages = await loadMessages(locale);

    expect(Object.keys(messages).length).toBeGreaterThan(0);
  });

  // A malformed ICU message (an unbalanced brace, a plural arm the locale has
  // no category for) renders as the raw key at runtime, so it survives review
  // and only shows up on the page.
  it.each(i18nConfig.locales)('formats every %s message', async (locale) => {
    const messages = await loadMessages(locale);
    const failures: Array<string> = [];
    const t = createTranslator({
      locale,
      // next-intl reads dots as path separators, matching `request.ts`.
      messages: Object.fromEntries(
        Object.entries(messages).map(([key, value]) => [
          key.replaceAll('.', '_'),
          value,
        ]),
      ),
      onError: (error) => failures.push(error.message),
    });

    for (const [key, message] of Object.entries(messages)) {
      // rich() rather than t(): it handles both plain and tag-bearing messages.
      t.rich(key.replaceAll('.', '_'), argumentsIn(message));
    }

    expect(failures).toEqual([]);
  });
});

import type { Messages } from 'use-intl';

import { i18nConfig } from './config';

/**
 * The dictionary for a locale, falling back to the default for one we don't
 * support. Loaded on demand, so a page ships only its own locale's messages.
 */
export const loadMessages = async (locale: string): Promise<Messages> => {
  const supported =
    i18nConfig.locales.find((candidate) => candidate === locale) ??
    i18nConfig.defaultLocale;

  return (await import(`./dictionaries/${supported}.json`)).default;
};

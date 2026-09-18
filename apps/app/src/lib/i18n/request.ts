import { logger } from '@op/logging';
import { IntlErrorCode } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import type { MessageTree } from './messageKeys';
import { normalizeMessageKeys } from './messageKeys';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  // Top-level entries are legacy keys — the English source string; namespace
  // objects below them are keyed by ID (ADR 0005) and pass through untouched.
  const rawMessages: MessageTree = (
    await import(`./dictionaries/${locale}.json`)
  ).default;

  return {
    locale,
    messages: normalizeMessageKeys(rawMessages),
    timeZone: 'UTC',
    onError(error: { code: string }) {
      if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) {
        // Silently ignore — timeZone is set globally, but now/relativeTime
        // fallbacks are non-fatal and shouldn't crash SSR.
        return;
      }
      // Default next-intl behavior: log other errors
      logger.error('next-intl request config error', { error });
    },
  };
});

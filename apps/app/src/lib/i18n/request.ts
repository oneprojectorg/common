import { IntlErrorCode } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

// allows usage of periods in the keys so we can use english as the natural keys
const getConfig = async (messages: Record<string, any>) => {
  const adjustKeys = (obj: Record<string, any>): Record<string, any> =>
    Object.fromEntries(
      Object.entries(obj).map(([key, value]) =>
        typeof value === 'string'
          ? [key.replaceAll('.', '_'), value]
          : [
              key,
              typeof value === 'object' && value !== null
                ? adjustKeys(value)
                : value,
            ],
      ),
    );

  // periods are parsed as path separators by next-intl, so we need to replace
  // them with underscores both here and in the t function returned by useTranslations
  return adjustKeys(messages);
};

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  const rawMessages = (await import(`./dictionaries/${locale}.json`)).default;

  return {
    locale,
    // messages: await getConfig(locale),
    messages: await getConfig(rawMessages),
    timeZone: 'UTC',
    getMessageFallback({
      key,
    }: {
      namespace?: string;
      key: string;
      error: { code: string };
    }): string {
      // Return the key as-is to match the client-side I18nProvider's
      // getMessageFallback behavior (provider/index.tsx). Without this,
      // next-intl's default fallback returns the last path segment,
      // causing server/client text divergence for missing keys.
      return key;
    },
    onError(error: { code: string }) {
      if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) {
        // Silently ignore — timeZone is set globally, but now/relativeTime
        // fallbacks are non-fatal and shouldn't crash SSR.
        return;
      }
      // Default next-intl behavior: log other errors
      console.error(error);
    },
  };
});

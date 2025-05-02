import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

// allows usage of periods in the keys so we can use english as the natural keys
const getConfig = async (locale: string) => {
  const messages = (await import(`./dictionaries/${locale}.json`)).default;

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
  return { messages: adjustKeys(messages) };
};

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: await getConfig(locale),
  };
});

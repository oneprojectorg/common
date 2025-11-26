export const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'pt', 'bn'],
  localeDetection: true,
};

export type Locale = (typeof i18nConfig)['locales'][number];

export type SupportedLocale = (typeof i18nConfig.locales)[number];

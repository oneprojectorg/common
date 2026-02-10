/** Platform-supported locales matching the i18n dictionaries. */
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'pt', 'bn'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Maps platform locale codes to DeepL target language codes.
 * DeepL requires regional variants for some languages (e.g. EN-US, PT-BR).
 */
export const LOCALE_TO_DEEPL: Record<SupportedLocale, string> = {
  en: 'EN-US',
  es: 'ES',
  fr: 'FR',
  pt: 'PT-BR',
  bn: 'BN',
} as const;

/**
 * Platform-supported locales matching the i18n dictionaries.
 *
 * Build-time consumers (e.g. `apps/app/next.config.mjs`) import the parallel
 * `@op/common/locales.mjs` instead — kept in lockstep with the TS source by
 * `locales.test.ts`. The `.mjs` mirror lives at the package root rather than
 * here so it can't shadow `./locales` lookups inside the package.
 */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'pt',
  'bn',
  'so',
  'ar',
] as const;

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
  so: 'SO',
  ar: 'AR',
} as const;

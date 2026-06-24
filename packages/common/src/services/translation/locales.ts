import { SUPPORTED_LOCALES } from './locales.mjs';

export { SUPPORTED_LOCALES };

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

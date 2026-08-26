import { SUPPORTED_LOCALES } from '@op/common/locales.mjs';

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
  hu: 'HU',
} as const;

/**
 * Locales that DeepL does not support and must be routed to OpenL (via
 * RapidAPI) instead. The value is OpenL's target language code.
 */
export const LOCALE_TO_OPENL = {
  so: 'so',
} as const satisfies Partial<Record<SupportedLocale, string>>;

/** True when a locale must be translated by OpenL rather than DeepL. */
export function usesOpenL(
  locale: SupportedLocale,
): locale is keyof typeof LOCALE_TO_OPENL {
  return locale in LOCALE_TO_OPENL;
}

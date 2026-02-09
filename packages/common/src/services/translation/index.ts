export { translateBatch } from './translateBatch';
export type { TranslatableEntry, TranslationResult } from './translateBatch';
export { hashContent } from './hashContent';

/**
 * DeepL target language codes for platform-supported locales.
 *
 * Maps to our i18n dictionaries: bn, en, es, fr, pt.
 * DeepL requires regional variants for English and Portuguese targets.
 */
export const SUPPORTED_TARGET_LOCALES = [
  'BN',
  'EN-US',
  'ES',
  'FR',
  'PT-BR',
] as const;

export type SupportedTargetLocale = (typeof SUPPORTED_TARGET_LOCALES)[number];

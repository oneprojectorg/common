import { type SupportedLocale } from '@op/common/client';
import { franc } from 'franc';

// franc reports languages as ISO 639-3; map the ones we support back to the
// app's locale codes (ISO 639-1). Restricting franc to just these via `only`
// is important: unconstrained, it likes to pick near-neighbours (e.g. Scots
// for English), which would wrongly flag same-language content as translatable.
const SUPPORTED_LANGUAGE_CODES: Record<string, SupportedLocale> = {
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  por: 'pt',
  ben: 'bn',
  som: 'so',
  arb: 'ar',
  hun: 'hu',
};

const FRANC_ONLY = Object.keys(SUPPORTED_LANGUAGE_CODES);

/** The base language subtag, lowercased — e.g. `en` from `en-US`. */
export const baseLanguage = (code: string): string =>
  code.toLowerCase().split('-')[0] ?? code;

/**
 * Detects the language of `text` using franc (pure-JS trigram detection),
 * restricted to the platform's supported locales. Returns the matching locale
 * code, or an empty array when the text is too short to judge or its language
 * isn't one we support.
 */
export const detectLanguages = (text: string): string[] => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const code = franc(trimmed, { only: FRANC_ONLY });
  const locale = SUPPORTED_LANGUAGE_CODES[code];

  return locale ? [locale] : [];
};

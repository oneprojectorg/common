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

/**
 * How many letters a sample needs before its verdict is worth anything.
 *
 * `only` makes franc a forced choice: it scores the eight candidates against
 * each other and returns the closest, so it never reports "unsure" the way an
 * unrestricted run does. On a short sample the trigram evidence is noise and
 * that closest-of-eight is arbitrary — measured over a corpus of real proposal
 * titles, phase headlines and author names, roughly two in five English
 * strings came back as Spanish, French, Portuguese, Somali or Hungarian. The
 * badge ORs its verdict over every sample on the screen, so at list scale one
 * bad title was enough to show it on decisions with nothing to translate.
 *
 * 40 letters is where the false positives stop across that corpus (the last
 * one falls out at 35) while full proposal bodies, which are what carries a
 * real foreign-language signal, stay well clear of the floor.
 *
 * Letters rather than characters: digits, punctuation and whitespace pad the
 * length without telling franc anything, and franc's own `minLength` counts
 * them, which is part of why its 10-character default lets noise through.
 */
const MIN_DETECTION_LETTERS = 40;

const countLetters = (text: string): number =>
  text.match(/\p{L}/gu)?.length ?? 0;

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
  if (countLetters(trimmed) < MIN_DETECTION_LETTERS) {
    return [];
  }

  const code = franc(trimmed, { only: FRANC_ONLY });
  const locale = SUPPORTED_LANGUAGE_CODES[code];

  return locale ? [locale] : [];
};

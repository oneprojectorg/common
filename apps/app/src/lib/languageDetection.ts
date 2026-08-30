import { type SupportedLocale } from '@op/common/client';
import { francAll } from 'franc';

// franc reports languages as ISO 639-3; map the ones we support back to the
// app's locale codes (ISO 639-1). Restricting franc to just these via `only`
// is important: unconstrained, it likes to pick near-neighbours (e.g. Scots
// for English), which would wrongly flag same-language content as translatable.
//
// Adding a locale that shares a script with one already here (Urdu or Persian
// with Arabic, Assamese with Bengali) turns that script's verdict from settled
// into contested, which puts it behind the letter floor — see `detectLanguages`.
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
 * How many letters a sample needs before a *contested* verdict is worth
 * anything (see `detectLanguages` for when a verdict is contested).
 *
 * Trigrams need prose to work on. Below this, franc is picking between
 * languages on the evidence of a few words: across a corpus of realistic
 * proposal titles, phase headlines and author names, roughly two in five
 * English strings came back as Spanish, French, Portuguese, Somali or
 * Hungarian, the last of them at 35 letters. The badge ORs its verdict over
 * every sample on the screen, so at list scale one bad title was enough to
 * show it on a decision with nothing to translate.
 *
 * 40 is a floor on that noise, not a guarantee: a long enough English
 * noun-phrase title with no function words in it ("Public Restroom Facilities
 * at Downtown Transit Center") can still be misread. Prose clears the floor
 * comfortably, which is why the sample builders feed whole items rather than
 * bare labels.
 *
 * Letters rather than characters: digits, punctuation and whitespace pad the
 * length without telling franc anything, and franc's own `minLength` counts
 * them, which is why its 10-character default lets noise through.
 */
const MIN_DETECTION_LETTERS = 40;

/** franc's own `MAX_LENGTH` — it ignores anything past this, so we do too. */
const MAX_FRANC_LENGTH = 2048;

/**
 * Whether `text` carries at least {@link MIN_DETECTION_LETTERS} letters.
 * Stops at the threshold rather than counting every letter in a 2000-character
 * body, since all the caller needs is the comparison.
 */
const hasEnoughLetters = (text: string): boolean => {
  const letter = /\p{L}/gu;

  for (let found = 0; found < MIN_DETECTION_LETTERS; found++) {
    if (!letter.exec(text)) {
      return false;
    }
  }

  return true;
};

/** The base language subtag, lowercased — e.g. `en` from `en-US`. */
export const baseLanguage = (code: string): string =>
  code.toLowerCase().split('-')[0] ?? code;

/**
 * Detects the language of `text` using franc (pure-JS trigram detection),
 * restricted to the platform's supported locales. Returns the matching locale
 * code, or an empty array when the text is too short to judge or its language
 * isn't one we support.
 *
 * franc narrows by script before it scores trigrams, so `only` leaves it with
 * either one candidate or several. One candidate means the script settled it —
 * Arabic and Bengali text can only be `ar` and `bn` here — and a verdict with
 * nothing to compete against holds however short the sample is. Several
 * candidates means it is choosing between the Latin-script locales on trigram
 * evidence alone, and since `only` gives it no way to answer "none of these",
 * that choice is worthless until there is enough text to base it on.
 */
export const detectLanguages = (text: string): string[] => {
  // Trimmed and capped once, so franc and the letter floor judge the same
  // string. franc's own `minLength` counts raw characters and it only reads
  // the first `MAX_FRANC_LENGTH`, so untrimmed padding would otherwise buy a
  // sample past that floor on a handful of letters, and letters past the cap
  // would count toward ours without ever reaching franc.
  const sample = text.trim().slice(0, MAX_FRANC_LENGTH);

  const candidates = francAll(sample, { only: FRANC_ONLY });
  const winner = candidates[0];
  if (!winner) {
    return [];
  }

  // `und` when franc found nothing to go on; anything unmapped is a language
  // we can't translate into anyway.
  const locale = SUPPORTED_LANGUAGE_CODES[winner[0]];
  if (!locale) {
    return [];
  }

  if (candidates.length > 1 && !hasEnoughLetters(sample)) {
    return [];
  }

  return [locale];
};

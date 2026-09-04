/**
 * Direction of the first strong character in a value, or `null` when there is
 * none (empty, whitespace, digits, punctuation).
 *
 * Used instead of `dir="auto"` because `auto` is not equivalent: the UA
 * stylesheet gives `textarea[dir=auto]` (and `pre`) `unicode-bidi: plaintext`,
 * which resolves direction per *line*, so a blank line inside otherwise Arabic
 * text still resolves LTR under UAX9 P3. An explicit `dir` gets
 * `unicode-bidi: isolate` instead, giving the whole control one base direction.
 * `auto` also disagrees across browsers on an empty value: Chrome 120+ inherits
 * the parent per spec, Safari and Firefox resolve LTR.
 *
 * Returning `null` rather than a guess matters: with no strong character there
 * is nothing to get wrong, so the caller leaves `dir` off and the control
 * inherits the page direction.
 *
 * Detection is script-based, which is a shade narrower than UAX9 P2: a few
 * Arabic punctuation marks (U+061F ARABIC QUESTION MARK) carry bidi class AL
 * while their Unicode script is Common, so a value of nothing but those returns
 * `null` and inherits instead of resolving RTL. Harmless — there are no letters
 * to mis-order — and JS regexes can't match on bidi class.
 */
const RTL_SCRIPTS =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}]/u;
const LETTER = /\p{L}/u;

export function firstStrongDirection(value: unknown): 'rtl' | 'ltr' | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  for (const character of String(value)) {
    // RTL first: `\p{L}` matches Arabic and Hebrew letters too.
    if (RTL_SCRIPTS.test(character)) {
      return 'rtl';
    }
    if (LETTER.test(character)) {
      return 'ltr';
    }
  }

  return null;
}

import { describe, expect, it } from 'vitest';

import { baseLanguage, detectLanguages } from './languageDetection';

describe('baseLanguage', () => {
  it('lowercases and strips the region/script subtag', () => {
    expect(baseLanguage('en-US')).toBe('en');
    expect(baseLanguage('ZH-Latn')).toBe('zh');
    expect(baseLanguage('es')).toBe('es');
  });
});

describe('detectLanguages', () => {
  it('returns an empty array for blank text', () => {
    expect(detectLanguages('   ')).toEqual([]);
  });

  it('detects English content', () => {
    expect(
      detectLanguages(
        'This is a fairly long English sentence that the detector should recognize clearly.',
      ),
    ).toEqual(['en']);
  });

  it('detects non-English content in a supported language', () => {
    expect(
      detectLanguages(
        'Esta es una frase bastante larga en español que el detector debería reconocer con claridad.',
      ),
    ).toEqual(['es']);
  });

  it('detects Hungarian content', () => {
    expect(
      detectLanguages(
        'Ez egy elég hosszú magyar mondat, amelyet a felismerőnek egyértelműen fel kell ismernie.',
      ),
    ).toEqual(['hu']);
  });

  // Between the Latin-script locales franc has to name one of them — `only`
  // gives it no way to answer "none of these". On a bare label there is no
  // prose for it to go on, so it used to return an arbitrary foreign language
  // and light up the translate badge on an all-English screen. These three are
  // the worst of a larger corpus: each resolved to a different wrong language
  // (Portuguese, French, Somali).
  it.each([
    'Translate City Documents into Spanish',
    'Youth Sports League Equipment Grant',
    'Neighborhood Watch Radio Network',
  ])('returns no verdict for the English title %j', (title) => {
    expect(detectLanguages(title)).toEqual([]);
  });

  // A proposal author's name is the fallback title when a proposal has none.
  it('returns no verdict for a person name', () => {
    expect(detectLanguages('Scott Cazan')).toEqual([]);
  });

  // Pins the 40-letter threshold. Both halves are English prose that franc
  // reads correctly, so only the letter count decides the verdict — raising or
  // lowering the floor breaks one of them. The strings are truncated
  // mid-sentence to land on the exact counts.
  it('withholds a contested verdict at 39 letters', () => {
    expect(
      detectLanguages('The community centre roof has leaked for three'),
    ).toEqual([]);
  });

  it('returns a contested verdict at 40 letters', () => {
    expect(
      detectLanguages('The community centre roof has leaked for three w'),
    ).toEqual(['en']);
  });

  it('counts letters rather than characters', () => {
    // 60 characters but only six letters — the padding tells franc nothing,
    // and franc's own `minLength` would have counted all of it.
    expect(
      detectLanguages(
        'Budget 2026 100 250 500 1000 2500 5000 7500 9000 12500 15000',
      ),
    ).toEqual([]);
  });

  // Arabic and Bengali are the only candidates in their scripts here, so franc
  // settles them before it ever scores trigrams. A verdict with nothing to
  // compete against holds at any length — gating these on the letter floor
  // would hide the badge from the readers translation exists for.
  it('detects short Arabic text', () => {
    expect(detectLanguages('حديقة المجتمع للجميع')).toEqual(['ar']);
  });

  it('detects short Bengali text', () => {
    expect(detectLanguages('কমিউনিটি বাগান প্রকল্প')).toEqual(['bn']);
  });

  it('still detects a foreign proposal once its body is included', () => {
    expect(
      detectLanguages(
        'Proyecto de Huerta Comunitaria\nQueremos construir una huerta compartida en el terreno baldío para que los vecinos cultiven juntos.',
      ),
    ).toEqual(['es']);
  });
});

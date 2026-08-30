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

  // Restricted to the supported languages, franc always names one of them —
  // it has no "unsure" verdict. On a short sample the trigram evidence is
  // noise, so it used to hand back an arbitrary foreign language and light up
  // the translate badge on an all-English screen.
  it.each([
    'Community Garden Project',
    'Youth Mentorship Program',
    'Food Bank Expansion',
    'Submit your ideas',
    'Bike Lane Improvements',
    'Senior Center Meals',
    'Mental Health Support',
    'Solar Panels for Schools',
    'Test proposal',
    'Translate City Documents into Spanish',
    'Youth Sports League Equipment Grant',
    'Neighborhood Watch Radio Network',
  ])('returns no verdict for the short English title %j', (title) => {
    expect(detectLanguages(title)).toEqual([]);
  });

  // A proposal author's name is the fallback title when a proposal has none.
  it('returns no verdict for a person name', () => {
    expect(detectLanguages('Scott Cazan')).toEqual([]);
  });

  it('ignores digits and punctuation when measuring how much text there is', () => {
    // Long enough to pass franc's own 10-character floor, but only a handful
    // of letters actually carry a language signal.
    expect(
      detectLanguages('1 (2) 3, 4. 5; 6: 7 - 8 / 9 [10] 11 {12} 13!'),
    ).toEqual([]);
  });

  it('still detects a foreign proposal once its body is included', () => {
    expect(
      detectLanguages(
        'Proyecto de Huerta Comunitaria\nQueremos construir una huerta compartida en el terreno baldío para que los vecinos cultiven juntos.',
      ),
    ).toEqual(['es']);
  });
});

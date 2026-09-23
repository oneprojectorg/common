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

  // franc guesses wrong on short Latin-script text: these English strings
  // detect as Portuguese and French, which showed "Translate to English" on
  // English decisions whose only copy was a phase headline or a title.
  it.each([
    'Review Progress',
    'Our Voice, Our Choice Budget',
    'Submit your ideas',
  ])('does not judge short Latin-script text (%s)', (text) => {
    expect(detectLanguages(text)).toEqual([]);
  });

  it('still detects short text in a non-Latin script', () => {
    expect(detectLanguages('برنامج الفنون للشباب')).toEqual(['ar']);
    expect(detectLanguages('যুব শিল্প কর্মসূচি')).toEqual(['bn']);
  });
});

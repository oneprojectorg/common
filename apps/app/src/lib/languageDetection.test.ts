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
});

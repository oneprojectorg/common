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
  it('returns an empty array for blank text', async () => {
    expect(await detectLanguages('   ')).toEqual([]);
  });

  it('detects English content', async () => {
    const languages = await detectLanguages(
      'This is a fairly long English sentence that the detector should recognize clearly.',
    );

    expect(languages).toContain('en');
  });

  it('detects non-English content', async () => {
    const languages = await detectLanguages(
      'Esta es una frase bastante larga en español que el detector debería reconocer con claridad.',
    );

    expect(languages).toContain('es');
    expect(languages).not.toContain('en');
  });
});

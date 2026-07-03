import { describe, expect, it } from 'vitest';

import {
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

describe('flattenTranslatableFields / unflattenTranslatedFields', () => {
  it('round-trips string and array fields', () => {
    const entries = flattenTranslatableFields('proposal:abc:', {
      title: 'Hello',
      category: ['One', 'Two'],
      empty: undefined,
    });

    expect(entries).toEqual([
      { contentKey: 'proposal:abc:title', text: 'Hello' },
      { contentKey: 'proposal:abc:category[0]', text: 'One' },
      { contentKey: 'proposal:abc:category[1]', text: 'Two' },
    ]);

    const { translated, sourceLocale } = unflattenTranslatedFields(
      'proposal:abc:',
      entries.map((e) => ({
        contentKey: e.contentKey,
        translatedText: `[ES] ${e.text}`,
        sourceLocale: 'EN',
        cached: false,
      })),
    );

    expect(translated).toEqual({
      title: '[ES] Hello',
      category: ['[ES] One', '[ES] Two'],
    });
    expect(sourceLocale).toBe('EN');
  });

  // Regression: template field keys can be all digits (e.g. "77963788").
  // Keys like "field_title:77963788" must stay scalar — treating the digits
  // as an array index allocated a ~78M-slot array and OOM'd the API process.
  it('keeps scalar keys with an all-digit trailing segment as strings', () => {
    const { translated } = unflattenTranslatedFields('proposal:abc:', [
      {
        contentKey: 'proposal:abc:field_title:77963788',
        translatedText: 'Why is this project important?',
        sourceLocale: 'AR',
        cached: false,
      },
      {
        contentKey: 'proposal:abc:field_desc:77963788',
        translatedText: 'Tell us why.',
        sourceLocale: 'AR',
        cached: false,
      },
      {
        contentKey: 'proposal:abc:option:someField:2024',
        translatedText: 'Year 2024',
        sourceLocale: 'AR',
        cached: false,
      },
    ]);

    expect(translated['field_title:77963788']).toBe(
      'Why is this project important?',
    );
    expect(translated['field_desc:77963788']).toBe('Tell us why.');
    expect(translated['option:someField:2024']).toBe('Year 2024');
    expect(Array.isArray(translated.field_title)).toBe(false);
  });

  it('treats bracket keys with an out-of-range index as scalars', () => {
    const { translated } = unflattenTranslatedFields('proposal:abc:', [
      {
        contentKey: 'proposal:abc:option:someField:x[77963788]',
        translatedText: 'huge',
        sourceLocale: 'EN',
        cached: false,
      },
    ]);

    expect(translated['option:someField:x[77963788]']).toBe('huge');
  });
});

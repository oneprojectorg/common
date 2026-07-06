import type { TranslationResult } from '@op/translation';
import { describe, expect, it } from 'vitest';

import {
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

const result = (
  contentKey: string,
  translatedText: string,
): TranslationResult => ({
  contentKey,
  translatedText,
  sourceLocale: 'EN',
  cached: false,
});

describe('flattenTranslatableFields / unflattenTranslatedFields', () => {
  it('round-trips a scalar field', () => {
    const entries = flattenTranslatableFields('p:', { title: 'Hello' });
    expect(entries).toEqual([{ contentKey: 'p:title', text: 'Hello' }]);

    const { translated } = unflattenTranslatedFields(
      'p:',
      entries.map((e) => result(e.contentKey, e.text)),
    );
    expect(translated.title).toBe('Hello');
  });

  it('round-trips a real array field via dense indices', () => {
    const entries = flattenTranslatableFields('p:', {
      category: ['Housing', 'Transit'],
    });
    expect(entries.map((e) => e.contentKey)).toEqual([
      'p:category:0',
      'p:category:1',
    ]);

    const { translated } = unflattenTranslatedFields(
      'p:',
      entries.map((e) => result(e.contentKey, e.text)),
    );
    expect(translated.category).toEqual(['Housing', 'Transit']);
  });

  // ONE-401: a proposal template field id can be all digits (e.g. "77963788").
  // Its entry key is `field_title:77963788`, which must NOT be read as
  // array index 77_963_788 — that allocated a ~78M-element sparse array and
  // OOM'd the process. It must be stored as a scalar key instead.
  it('treats a large numeric field-id suffix as a scalar key, not a giant array', () => {
    const { translated } = unflattenTranslatedFields('p:', [
      result('p:field_title:77963788', 'Question title'),
      result('p:field_desc:77963788', 'Question description'),
    ]);

    expect(translated['field_title:77963788']).toBe('Question title');
    expect(translated['field_desc:77963788']).toBe('Question description');
    // Must not have been coerced into an array under the base field name.
    expect(translated.field_title).toBeUndefined();
    expect(Array.isArray(translated.field_title)).toBe(false);
  });

  it('still reconstructs small numeric array indices at the cap boundary', () => {
    const { translated } = unflattenTranslatedFields('p:', [
      result('p:tags:0', 'a'),
      result('p:tags:2', 'c'),
    ]);
    expect(translated.tags).toEqual(['a', undefined, 'c']);
  });
});

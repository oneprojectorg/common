import { describe, expect, it } from 'vitest';

import { parseTranslatedMeta } from './parseTranslatedMeta';

describe('parseTranslatedMeta', () => {
  it('splits field and option keys into their own maps', () => {
    const meta = parseTranslatedMeta({
      'field_title:impact': 'Impacto',
      'field_desc:impact': '¿A cuántas personas?',
      'option:impact:high': 'Alto',
      'option:impact:low': 'Bajo',
      'option_desc:impact:high': 'Toda la ciudad',
    });

    expect(meta).toEqual({
      fieldTitles: { impact: 'Impacto' },
      fieldDescriptions: { impact: '¿A cuántas personas?' },
      optionLabels: { impact: { high: 'Alto', low: 'Bajo' } },
      optionDescriptions: { impact: { high: 'Toda la ciudad' } },
    });
  });

  it('keeps an option value that contains a colon intact', () => {
    const meta = parseTranslatedMeta({ 'option:impact:a:b': 'Etiqueta' });

    expect(meta.optionLabels).toEqual({ impact: { 'a:b': 'Etiqueta' } });
  });

  it('ignores non-metadata keys and array values', () => {
    const meta = parseTranslatedMeta({
      title: 'Jardín comunitario',
      category: ['Vivienda'],
      // No option value — nothing to key it by.
      'option:impact': 'Alto',
    });

    expect(meta).toEqual({
      fieldTitles: {},
      fieldDescriptions: {},
      optionLabels: {},
      optionDescriptions: {},
    });
  });
});

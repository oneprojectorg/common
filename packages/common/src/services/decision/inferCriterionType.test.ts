import { describe, expect, it } from 'vitest';

import {
  getCriterionMaxPoints,
  getOneOfEntries,
  inferCriterionType,
} from './inferCriterionType';
import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

describe('inferCriterionType', () => {
  it('infers long_text from the long-text format', () => {
    expect(
      inferCriterionType({ type: 'string', 'x-format': 'long-text' }),
    ).toBe('long_text');
  });

  it('infers scored from an integer dropdown with a maximum', () => {
    expect(
      inferCriterionType({
        type: 'integer',
        'x-format': 'dropdown',
        minimum: 1,
        maximum: 5,
      }),
    ).toBe('scored');
  });

  it('does not infer scored without a maximum', () => {
    expect(
      inferCriterionType({ type: 'integer', 'x-format': 'dropdown' }),
    ).toBeUndefined();
  });

  it('infers yes_no from exactly a yes and a no option', () => {
    expect(
      inferCriterionType({
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'yes', title: 'Yes' },
          { const: 'no', title: 'No' },
        ],
      }),
    ).toBe('yes_no');
  });

  it('infers single_select from any other string dropdown with options', () => {
    expect(
      inferCriterionType({
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'yes', title: 'Yes' },
          { const: 'maybe', title: 'Maybe' },
          { const: 'no', title: 'No' },
        ],
      }),
    ).toBe('single_select');
  });

  it('returns undefined for a string dropdown without options', () => {
    expect(
      inferCriterionType({ type: 'string', 'x-format': 'dropdown' }),
    ).toBeUndefined();
  });

  it('returns undefined for non-dropdown, non-long-text formats', () => {
    expect(
      inferCriterionType({ type: 'string', 'x-format': 'short-text' }),
    ).toBeUndefined();
  });
});

describe('getOneOfEntries', () => {
  it('returns oneOf entries, filtering out boolean definitions', () => {
    const schema: XFormatPropertySchema = {
      type: 'string',
      oneOf: [{ const: 'a', title: 'A' }, true, { const: 'b', title: 'B' }],
    };

    expect(getOneOfEntries(schema).map((e) => e.const)).toEqual(['a', 'b']);
  });

  it('returns an empty array when oneOf is missing', () => {
    expect(getOneOfEntries({ type: 'string' })).toEqual([]);
  });
});

describe('getCriterionMaxPoints', () => {
  const template: RubricTemplateSchema = {
    type: 'object',
    properties: {
      score: {
        type: 'integer',
        'x-format': 'dropdown',
        minimum: 1,
        maximum: 4,
      },
      choice: {
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [{ const: 'a', title: 'A' }],
      },
    },
  };

  it('returns the maximum for integer criteria', () => {
    expect(getCriterionMaxPoints(template, 'score')).toBe(4);
  });

  it('returns undefined for non-integer criteria', () => {
    expect(getCriterionMaxPoints(template, 'choice')).toBeUndefined();
  });

  it('returns undefined for unknown criteria', () => {
    expect(getCriterionMaxPoints(template, 'missing')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { parseRubricReviewData } from './parseRubricReviewData';
import type { RubricTemplateSchema } from './types';

const seiRubricTemplate = {
  type: 'object',
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Poor' },
        { const: 2, title: 'Below Average' },
        { const: 3, title: 'Average' },
        { const: 4, title: 'Good' },
        { const: 5, title: 'Excellent' },
      ],
    },
    meetsEligibility: {
      type: 'string',
      title: 'Meets Eligibility',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
    strengthsSummary: {
      type: 'string',
      title: 'Key Strengths',
      'x-format': 'short-text',
    },
    __overall_recommendation: {
      type: 'string',
      title: 'Overall Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'maybe', title: 'Maybe' },
        { const: 'no', title: 'No' },
      ],
    },
  },
} as const satisfies RubricTemplateSchema;

describe('parseRubricReviewData', () => {
  it('parses scored integer answers as numbers', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { innovation: 4 },
      rationales: {},
    });

    expect(parsed.answers.innovation).toBe(4);
    expect(typeof parsed.answers.innovation).toBe('number');
  });

  it('parses dropdown const enums as their literal value', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { meetsEligibility: 'yes' },
      rationales: {},
    });

    expect(parsed.answers.meetsEligibility).toBe('yes');
  });

  it('parses the __overall_recommendation enum', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { __overall_recommendation: 'maybe' },
      rationales: {},
    });

    expect(parsed.answers.__overall_recommendation).toBe('maybe');
  });

  it('parses free-text criteria as strings', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { strengthsSummary: 'Solid plan' },
      rationales: {},
    });

    expect(parsed.answers.strengthsSummary).toBe('Solid plan');
  });

  it('drops a single malformed answer without losing siblings', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: {
        // out-of-range integer
        innovation: 99,
        // valid sibling
        meetsEligibility: 'yes',
      },
      rationales: {},
    });

    expect(parsed.answers.innovation).toBeUndefined();
    expect(parsed.answers.meetsEligibility).toBe('yes');
  });

  it('drops dropdown values that are not in the allowed consts', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { meetsEligibility: 'kinda' },
      rationales: {},
    });

    expect(parsed.answers.meetsEligibility).toBeUndefined();
  });

  it('coerces a stringified integer? no — keeps types strict', () => {
    // Number criteria reject string-encoded numbers; the storage layer is
    // expected to hold real JSON numbers.
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { innovation: '4' },
      rationales: {},
    });

    expect(parsed.answers.innovation).toBeUndefined();
  });

  it('preserves rationales when valid', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { innovation: 3 },
      rationales: { innovation: 'Good fit' },
    });

    expect(parsed.rationales).toEqual({ innovation: 'Good fit' });
  });

  it('returns empty halves when reviewData is missing entirely', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, null);

    expect(parsed).toEqual({ answers: {}, rationales: {} });
  });

  it('returns empty halves when reviewData has the wrong wrapper shape', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      // rationales should be Record<string, string>
      answers: {},
      rationales: { innovation: 42 },
    });

    expect(parsed).toEqual({ answers: {}, rationales: {} });
  });

  it('preserves unknown primitive keys when the criterion was removed from the template', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { legacyCriterion: 'kept' },
      rationales: {},
    });

    expect(parsed.answers.legacyCriterion).toBe('kept');
  });

  it('drops unknown keys whose value is non-primitive', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { legacyCriterion: { nested: true } },
      rationales: {},
    });

    expect(parsed.answers.legacyCriterion).toBeUndefined();
  });

  it('treats a null template as an empty-template parse (primitives preserved)', () => {
    const parsed = parseRubricReviewData(null, {
      answers: { __overall_recommendation: 'yes', score: 4 },
      rationales: { __overall_recommendation: 'good' },
    });

    expect(parsed.answers.__overall_recommendation).toBe('yes');
    expect(parsed.answers.score).toBe(4);
    expect(parsed.rationales).toEqual({ __overall_recommendation: 'good' });
  });
});

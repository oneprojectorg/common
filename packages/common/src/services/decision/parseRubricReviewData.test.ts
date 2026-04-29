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
  it('parses a fully-populated wrapper with primitive narrowing', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: {
        innovation: 4,
        meetsEligibility: 'yes',
        strengthsSummary: 'Solid plan',
        __overall_recommendation: 'maybe',
      },
      rationales: { innovation: 'Good fit' },
    });

    expect(parsed).toEqual({
      answers: {
        innovation: 4,
        meetsEligibility: 'yes',
        strengthsSummary: 'Solid plan',
        __overall_recommendation: 'maybe',
      },
      rationales: { innovation: 'Good fit' },
    });
    expect(typeof parsed.answers.innovation).toBe('number');
    expect(typeof parsed.answers.meetsEligibility).toBe('string');
  });

  it('drops all answers (kept rationales) when Ajv rejects the payload', () => {
    // out-of-range integer → Ajv rejects the whole answer payload, so we
    // drop every answer rather than silently surfacing a malformed row
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { innovation: 99, meetsEligibility: 'yes' },
      rationales: { innovation: 'questionable' },
    });

    expect(parsed.answers).toEqual({});
    expect(parsed.rationales).toEqual({ innovation: 'questionable' });
  });

  it('drops all answers when a dropdown value is not in the allowed consts', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { meetsEligibility: 'kinda' },
      rationales: {},
    });

    expect(parsed.answers).toEqual({});
  });

  it('rejects stringified numbers (Ajv coerceTypes is off)', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { innovation: '4' },
      rationales: {},
    });

    expect(parsed.answers).toEqual({});
  });

  it('returns empty halves when reviewData is missing entirely', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, null);

    expect(parsed).toEqual({ answers: {}, rationales: {} });
  });

  it('returns empty halves when the wrapper shape is wrong', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: {},
      rationales: { innovation: 42 }, // rationales must be Record<string, string>
    });

    expect(parsed).toEqual({ answers: {}, rationales: {} });
  });

  it('preserves a partial answer set (Ajv allows missing keys by default)', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { innovation: 3 },
      rationales: {},
    });

    expect(parsed.answers).toEqual({ innovation: 3 });
  });

  it('preserves keys for criteria removed from the template (additionalProperties default)', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { legacyCriterion: 'kept' },
      rationales: {},
    });

    expect(parsed.answers.legacyCriterion).toBe('kept');
  });

  it('drops the answers when a value is non-primitive (Zod narrow rejects)', () => {
    const parsed = parseRubricReviewData(seiRubricTemplate, {
      answers: { legacyCriterion: { nested: true } },
      rationales: {},
    });

    expect(parsed.answers).toEqual({});
  });

  it('skips Ajv when the template is null and narrows primitives via Zod', () => {
    const parsed = parseRubricReviewData(null, {
      answers: { __overall_recommendation: 'yes', score: 4 },
      rationales: { __overall_recommendation: 'good' },
    });

    expect(parsed.answers).toEqual({
      __overall_recommendation: 'yes',
      score: 4,
    });
    expect(parsed.rationales).toEqual({ __overall_recommendation: 'good' });
  });
});

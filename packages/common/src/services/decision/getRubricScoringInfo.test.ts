import { describe, expect, it } from 'vitest';

import { getRubricScoringInfo } from './getRubricScoringInfo';
import type { RubricTemplateSchema } from './types';

/**
 * SEI-style rubric template fixture.
 *
 * 6 criteria total:
 *   - 2 scored (integer, dropdown): innovation (max 5), feasibility (max 5)
 *   - 1 yes/no (dropdown, string)
 *   - 1 multiple-choice (dropdown, string)
 *   - 2 text fields (short-text + long-text)
 *
 * Expected: totalPoints = 10, 2 scored criteria.
 */
const seiRubricTemplate = {
  type: 'object',
  'x-field-order': [
    'innovation',
    'feasibility',
    'meetsEligibility',
    'focusArea',
    'strengthsSummary',
    'overallComments',
  ],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      description: 'Rate the innovation level of the proposal.',
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
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      description: 'Rate the feasibility of the proposal.',
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
      description: 'Does the proposal meet eligibility requirements?',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
    focusArea: {
      type: 'string',
      title: 'Focus Area',
      description: 'Primary focus area of the proposal.',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'education', title: 'Education' },
        { const: 'health', title: 'Health' },
        { const: 'environment', title: 'Environment' },
        { const: 'infrastructure', title: 'Infrastructure' },
      ],
    },
    strengthsSummary: {
      type: 'string',
      title: 'Key Strengths',
      description: 'Summarize the key strengths briefly.',
      'x-format': 'short-text',
    },
    overallComments: {
      type: 'string',
      title: 'Overall Comments',
      description: 'Provide detailed feedback for the proposer.',
      'x-format': 'long-text',
    },
  },
  required: ['innovation', 'feasibility', 'meetsEligibility'],
} as const satisfies RubricTemplateSchema;

describe('getRubricScoringInfo', () => {
  it('returns correct scoring info for SEI-style rubric', () => {
    const info = getRubricScoringInfo(seiRubricTemplate);

    expect(info.totalPoints).toBe(10);
    expect(info.criteria).toHaveLength(6);

    const scored = info.criteria.filter((c) => c.scored);
    expect(scored).toHaveLength(2);
    expect(scored.map((c) => c.key)).toEqual(['innovation', 'feasibility']);
    expect(scored.map((c) => c.maxPoints)).toEqual([5, 5]);
  });

  it('produces correct summary counts keyed by x-format', () => {
    const info = getRubricScoringInfo(seiRubricTemplate);

    expect(info.summary).toEqual({
      dropdown: 4,
      'short-text': 1,
      'long-text': 1,
    });
  });

  it('respects x-field-order for criteria ordering', () => {
    const info = getRubricScoringInfo(seiRubricTemplate);

    expect(info.criteria.map((c) => c.key)).toEqual([
      'innovation',
      'feasibility',
      'meetsEligibility',
      'focusArea',
      'strengthsSummary',
      'overallComments',
    ]);
  });

  it('uses property key as title fallback when title is missing', () => {
    const schema: RubricTemplateSchema = {
      type: 'object',
      properties: {
        untitledField: {
          type: 'string',
          'x-format': 'short-text',
        },
      },
    };

    const info = getRubricScoringInfo(schema);

    expect(info.criteria[0]!.title).toBe('untitledField');
  });

  it('handles empty schema gracefully', () => {
    const schema: RubricTemplateSchema = { type: 'object' };
    const info = getRubricScoringInfo(schema);

    expect(info.criteria).toEqual([]);
    expect(info.totalPoints).toBe(0);
    expect(info.summary).toEqual({});
  });

  it('handles schema with no properties', () => {
    const schema: RubricTemplateSchema = { type: 'object', properties: {} };
    const info = getRubricScoringInfo(schema);

    expect(info.criteria).toEqual([]);
    expect(info.totalPoints).toBe(0);
  });

  it('treats non-integer types as qualitative (0 points)', () => {
    const schema: RubricTemplateSchema = {
      type: 'object',
      properties: {
        numberField: {
          type: 'number',
          title: 'Number Field',
          maximum: 100,
          'x-format': 'dropdown',
        },
        stringField: {
          type: 'string',
          title: 'String Field',
          'x-format': 'short-text',
        },
      },
    };

    const info = getRubricScoringInfo(schema);

    expect(info.totalPoints).toBe(0);
    expect(info.criteria.every((c) => !c.scored)).toBe(true);
    expect(info.criteria.every((c) => c.maxPoints === 0)).toBe(true);
  });

  it('skips x-field-order entries that have no matching property', () => {
    const schema: RubricTemplateSchema = {
      type: 'object',
      'x-field-order': ['exists', 'ghost', 'alsoExists'],
      properties: {
        exists: { type: 'string', title: 'Exists', 'x-format': 'short-text' },
        alsoExists: {
          type: 'string',
          title: 'Also Exists',
          'x-format': 'long-text',
        },
      },
    };

    const info = getRubricScoringInfo(schema);

    expect(info.criteria).toHaveLength(2);
    expect(info.criteria.map((c) => c.key)).toEqual(['exists', 'alsoExists']);
  });

  it('includes properties not listed in x-field-order at the end', () => {
    const schema: RubricTemplateSchema = {
      type: 'object',
      'x-field-order': ['first'],
      properties: {
        first: { type: 'string', title: 'First', 'x-format': 'short-text' },
        unlisted: {
          type: 'string',
          title: 'Unlisted',
          'x-format': 'long-text',
        },
      },
    };

    const info = getRubricScoringInfo(schema);

    expect(info.criteria.map((c) => c.key)).toEqual(['first', 'unlisted']);
  });
});

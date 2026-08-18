import { describe, expect, it } from 'vitest';

import { OVERALL_RECOMMENDATION_KEY } from './getRubricScoringInfo';
import {
  getFreeTextCriterionKeys,
  getTranslatableRubricCopy,
  isYesNoCriterionSchema,
} from './rubricTranslatableCopy';
import type { RubricTemplateSchema } from './types';

const template = (
  properties: NonNullable<RubricTemplateSchema['properties']>,
): RubricTemplateSchema => ({ type: 'object', properties });

describe('getTranslatableRubricCopy', () => {
  it('collects criterion prompts, descriptions, and admin-written options', () => {
    const copy = getTranslatableRubricCopy(
      template({
        impact: {
          type: 'string',
          title: 'Impact',
          description: 'How many residents?',
          'x-format': 'dropdown',
          oneOf: [
            { const: 'a1', title: 'High', description: 'The whole city' },
            { const: 'a2', title: 'Low' },
          ],
        },
      }),
    );

    expect(copy).toEqual([
      {
        criterionKey: 'impact',
        title: 'Impact',
        description: 'How many residents?',
        options: [
          { value: 'a1', title: 'High', description: 'The whole city' },
          { value: 'a2', title: 'Low' },
        ],
      },
    ]);
  });

  // Its prompt and Yes/Maybe/No labels are written by
  // `enableOverallRecommendation`, not by an admin, and the UI reads them from
  // the dictionary — sending them made an all-Spanish rubric look part-English.
  it('skips the overall-recommendation criterion entirely', () => {
    const copy = getTranslatableRubricCopy(
      template({
        [OVERALL_RECOMMENDATION_KEY]: {
          type: 'string',
          title: 'Overall Recommendation',
          'x-format': 'dropdown',
          oneOf: [
            { const: 'yes', title: 'Yes' },
            { const: 'maybe', title: 'Maybe' },
            { const: 'no', title: 'No' },
          ],
        },
      }),
    );

    expect(copy).toEqual([]);
  });

  // Same reason, but only the options are ours: the prompt is the admin's.
  it('keeps a yes/no criterion prompt and drops its Yes/No labels', () => {
    const copy = getTranslatableRubricCopy(
      template({
        ready: {
          type: 'string',
          title: 'Is it ready to build?',
          'x-format': 'dropdown',
          oneOf: [
            { const: 'yes', title: 'Yes' },
            { const: 'no', title: 'No' },
          ],
        },
      }),
    );

    expect(copy).toEqual([
      { criterionKey: 'ready', title: 'Is it ready to build?', options: [] },
    ]);
  });

  // A legacy `enum` option's label *is* the answer every review stores, so
  // translating it would rewrite answers rather than copy.
  it('drops legacy enum options, whose labels are their stored values', () => {
    const copy = getTranslatableRubricCopy(
      template({
        theme: {
          type: 'string',
          title: 'Theme',
          'x-format': 'dropdown',
          enum: ['Water', 'Transit'],
        },
      }),
    );

    expect(copy).toEqual([
      { criterionKey: 'theme', title: 'Theme', options: [] },
    ]);
  });
});

describe('getFreeTextCriterionKeys', () => {
  it('reports the prose criteria and no dropdown', () => {
    const keys = getFreeTextCriterionKeys(
      template({
        notes: { type: 'string', 'x-format': 'long-text' },
        summary: { type: 'string', 'x-format': 'short-text' },
        impact: { type: 'integer', 'x-format': 'dropdown', maximum: 5 },
      }),
    );

    expect(keys).toEqual(['notes', 'summary']);
  });

  it('returns nothing for an absent rubric', () => {
    expect(getFreeTextCriterionKeys(null)).toEqual([]);
  });
});

describe('isYesNoCriterionSchema', () => {
  it('matches the builder yes/no criterion', () => {
    expect(
      isYesNoCriterionSchema({
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'yes', title: 'Yes' },
          { const: 'no', title: 'No' },
        ],
      }),
    ).toBe(true);
  });

  it('does not match a single-select that happens to offer yes', () => {
    expect(
      isYesNoCriterionSchema({
        type: 'string',
        'x-format': 'dropdown',
        oneOf: [
          { const: 'yes', title: 'Yes' },
          { const: 'maybe', title: 'Maybe' },
          { const: 'no', title: 'No' },
        ],
      }),
    ).toBe(false);
  });

  // Rewriting an enum label rewrites the stored answer, so this shape is never
  // treated as ours to relabel.
  it('does not match an enum-encoded yes/no', () => {
    expect(
      isYesNoCriterionSchema({
        type: 'string',
        'x-format': 'dropdown',
        enum: ['yes', 'no'],
      }),
    ).toBe(false);
  });
});

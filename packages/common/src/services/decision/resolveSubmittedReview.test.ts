import { ProposalReviewState } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { OVERALL_RECOMMENDATION_KEY } from './getRubricScoringInfo';
import { resolveSubmittedReview } from './resolveSubmittedReview';
import type { ProposalReview } from './schemas/reviews';
import type { RubricTemplateSchema } from './types';

/**
 * Rubric fixture covering every criterion kind the resolver handles:
 * scored, yes/no, single-select (opaque option ids + option descriptions),
 * overall recommendation, long-text, and short-text.
 */
const template: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': [
    'feasibility',
    'meetsEligibility',
    'focusArea',
    'strengths',
    'summary',
    OVERALL_RECOMMENDATION_KEY,
  ],
  properties: {
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      description: 'How feasible is the proposal?',
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
    focusArea: {
      type: 'string',
      title: 'Focus Area',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'a1b2c3d4', title: 'Parks', description: 'Green spaces' },
        { const: 'e5f6a7b8', title: 'Transit' },
      ],
    },
    strengths: {
      type: 'string',
      title: 'Strengths',
      'x-format': 'long-text',
    },
    summary: {
      type: 'string',
      title: 'Summary',
      'x-format': 'short-text',
    },
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
  },
};

const identityT = (key: string) => key;

function makeReview(
  answers: Record<string, unknown>,
  rationales: Record<string, string> = {},
  overallComment: string | null = null,
): ProposalReview {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    assignmentId: '00000000-0000-0000-0000-000000000002',
    state: ProposalReviewState.SUBMITTED,
    reviewData: { answers, rationales },
    overallComment,
    submittedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function resolve(review: ProposalReview, t = identityT) {
  return resolveSubmittedReview(template, review, { t });
}

function row(result: ReturnType<typeof resolve>, key: string) {
  const found = result.answers.find((answer) => answer.key === key);
  if (!found) {
    throw new Error(`no resolved row for ${key}`);
  }
  return found;
}

describe('resolveSubmittedReview', () => {
  it('returns one row per criterion in x-field-order', () => {
    const result = resolve(makeReview({}));

    expect(result.answers.map((answer) => answer.key)).toEqual([
      'feasibility',
      'meetsEligibility',
      'focusArea',
      'strengths',
      'summary',
      OVERALL_RECOMMENDATION_KEY,
    ]);
  });

  it('appends properties missing from x-field-order after the ordered ones', () => {
    const reordered: RubricTemplateSchema = {
      ...template,
      'x-field-order': ['summary', 'feasibility'],
    };
    const result = resolveSubmittedReview(reordered, makeReview({}), {
      t: identityT,
    });

    expect(result.answers.map((answer) => answer.key)).toEqual([
      'summary',
      'feasibility',
      'meetsEligibility',
      'focusArea',
      'strengths',
      OVERALL_RECOMMENDATION_KEY,
    ]);
  });

  it('carries the criterion title and description onto the row', () => {
    const result = resolve(makeReview({}));

    expect(row(result, 'feasibility').title).toBe('Feasibility');
    expect(row(result, 'feasibility').description).toBe(
      'How feasible is the proposal?',
    );
  });

  it('resolves yes_no answers through the injected t', () => {
    const t = (key: string) => `t:${key}`;
    const result = resolve(
      makeReview({ meetsEligibility: 'yes' }, { meetsEligibility: 'Solid.' }),
      t,
    );

    expect(row(result, 'meetsEligibility')).toMatchObject({
      type: 'yes_no',
      valueLabel: 't:Yes',
      rationale: 'Solid.',
    });
    expect(row(result, 'meetsEligibility').valueDescription).toBeUndefined();

    const no = resolve(makeReview({ meetsEligibility: 'no' }), t);
    expect(row(no, 'meetsEligibility').valueLabel).toBe('t:No');
  });

  it('leaves a missing yes_no answer unlabeled', () => {
    const result = resolve(makeReview({}));

    expect(row(result, 'meetsEligibility').valueLabel).toBeUndefined();
  });

  it('resolves a single_select opaque id to the option title and surfaces its description', () => {
    const result = resolve(
      makeReview({ focusArea: 'a1b2c3d4' }, { focusArea: 'Fits the area.' }),
    );

    expect(row(result, 'focusArea')).toMatchObject({
      type: 'single_select',
      valueLabel: 'Parks',
      valueDescription: 'Green spaces',
      rationale: 'Fits the area.',
    });
  });

  it('omits valueDescription when the chosen option has none', () => {
    const result = resolve(makeReview({ focusArea: 'e5f6a7b8' }));

    expect(row(result, 'focusArea')).toMatchObject({
      valueLabel: 'Transit',
      valueDescription: undefined,
    });
  });

  it('renders an em dash for a missing or unknown single_select answer', () => {
    expect(row(resolve(makeReview({})), 'focusArea').valueLabel).toBe('—');
    expect(
      row(resolve(makeReview({ focusArea: 'deleted-id' })), 'focusArea')
        .valueLabel,
    ).toBe('—');
  });

  it('resolves the overall recommendation by option title, not as yes_no', () => {
    const result = resolve(
      makeReview({ [OVERALL_RECOMMENDATION_KEY]: 'maybe' }),
    );

    expect(row(result, OVERALL_RECOMMENDATION_KEY)).toMatchObject({
      type: 'overall_recommendation',
      valueLabel: 'Maybe',
    });
    expect(
      row(result, OVERALL_RECOMMENDATION_KEY).valueDescription,
    ).toBeUndefined();
  });

  it('resolves scored answers with score label and maxPoints', () => {
    const result = resolve(
      makeReview({ feasibility: 4 }, { feasibility: 'Well planned.' }),
    );

    expect(row(result, 'feasibility')).toMatchObject({
      type: 'scored',
      valueLabel: '4',
      valueDescription: 'Good',
      maxPoints: 5,
      rationale: 'Well planned.',
    });
  });

  it('keeps maxPoints on a scored criterion with no answer', () => {
    const result = resolve(makeReview({}));

    expect(row(result, 'feasibility')).toMatchObject({
      type: 'scored',
      valueLabel: undefined,
      valueDescription: undefined,
      maxPoints: 5,
    });
  });

  it('sets maxPoints for scored criteria only', () => {
    const result = resolve(
      makeReview({ feasibility: 2, focusArea: 'a1b2c3d4' }),
    );

    for (const answer of result.answers) {
      if (answer.type === 'scored') {
        expect(answer.maxPoints).toBe(5);
      } else {
        expect(answer.maxPoints).toBeUndefined();
      }
    }
  });

  it('puts long-text and short-text answers in valueDescription', () => {
    const result = resolve(
      makeReview({ strengths: '  Strong team.  ', summary: 'Concise.' }),
    );

    expect(row(result, 'strengths')).toMatchObject({
      type: 'text',
      valueDescription: 'Strong team.',
    });
    expect(row(result, 'strengths').valueLabel).toBeUndefined();
    expect(row(result, 'summary').valueDescription).toBe('Concise.');
  });

  it('renders an em dash for missing or blank text answers', () => {
    const result = resolve(makeReview({ strengths: '   ' }));

    expect(row(result, 'strengths').valueDescription).toBe('—');
    expect(row(result, 'summary').valueDescription).toBe('—');
  });

  it('normalises whitespace-only rationales to undefined', () => {
    const result = resolve(
      makeReview({ feasibility: 3 }, { feasibility: '   ' }),
    );

    expect(row(result, 'feasibility').rationale).toBeUndefined();
  });

  it('returns the overall comment with its translated title', () => {
    const t = (key: string) => `t:${key}`;
    const result = resolve(makeReview({}, {}, 'Great work overall.'), t);

    expect(result.overallComment).toEqual({
      title: 't:Feedback to Author',
      comment: 'Great work overall.',
    });
  });

  it('returns no overall comment when it is null or empty', () => {
    expect(resolve(makeReview({})).overallComment).toBeNull();
    expect(resolve(makeReview({}, {}, '')).overallComment).toBeNull();
  });

  it('marks criteria with unsupported formats without resolving a value', () => {
    const withMoney: RubricTemplateSchema = {
      type: 'object',
      'x-field-order': ['budget'],
      properties: {
        budget: { type: 'number', title: 'Budget', 'x-format': 'money' },
      },
    };
    const result = resolveSubmittedReview(
      withMoney,
      makeReview({ budget: 5 }),
      {
        t: identityT,
      },
    );

    expect(result.answers[0]).toMatchObject({
      key: 'budget',
      type: 'unsupported',
    });
    expect(result.answers[0]?.valueLabel).toBeUndefined();
    expect(result.answers[0]?.valueDescription).toBeUndefined();
  });
});

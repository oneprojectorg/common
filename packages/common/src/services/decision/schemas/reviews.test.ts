import { describe, expect, it } from 'vitest';

import { rubricReviewDataSchema } from './reviews';

describe('rubricReviewDataSchema', () => {
  it('parses a fully populated object unchanged', () => {
    const result = rubricReviewDataSchema.parse({
      answers: { impact: 3, category: 'health' },
      rationales: { impact: 'Strong fit' },
    });

    expect(result).toEqual({
      answers: { impact: 3, category: 'health' },
      rationales: { impact: 'Strong fit' },
    });
  });

  it('fills both halves when an empty object is passed (legacy draft rows)', () => {
    const result = rubricReviewDataSchema.parse({});

    expect(result).toEqual({ answers: {}, rationales: {} });
  });

  it('fills missing rationales when only answers are present', () => {
    const result = rubricReviewDataSchema.parse({
      answers: { impact: 5 },
    });

    expect(result).toEqual({
      answers: { impact: 5 },
      rationales: {},
    });
  });

  it('rejects non-string rationale values', () => {
    expect(() =>
      rubricReviewDataSchema.parse({
        answers: { impact: 1 },
        rationales: { impact: 42 },
      }),
    ).toThrow();
  });
});

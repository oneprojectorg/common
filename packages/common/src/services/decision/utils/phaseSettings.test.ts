import { describe, expect, it } from 'vitest';

import {
  getPhaseReviewSettings,
  hasVotingPhase,
  isReviewPhase,
  isVotingPhase,
} from './phaseSettings';

describe('isReviewPhase', () => {
  it('reads reviews.submit as the source of truth', () => {
    expect(isReviewPhase({ rules: { reviews: { submit: true } } })).toBe(true);
    expect(
      isReviewPhase({
        rules: { reviews: { submit: false }, proposals: { review: true } },
      }),
    ).toBe(false);
  });

  it('falls back to the legacy proposals.review flag', () => {
    expect(isReviewPhase({ rules: { proposals: { review: true } } })).toBe(
      true,
    );
    expect(isReviewPhase({ rules: { proposals: { review: false } } })).toBe(
      false,
    );
  });

  it('defaults to false when neither flag is set', () => {
    expect(isReviewPhase({ rules: {} })).toBe(false);
    expect(isReviewPhase({})).toBe(false);
  });
});

describe('isVotingPhase', () => {
  it('reads voting.submit, defaulting to false', () => {
    expect(isVotingPhase({ rules: { voting: { submit: true } } })).toBe(true);
    expect(isVotingPhase({ rules: { voting: { submit: false } } })).toBe(false);
    expect(isVotingPhase({})).toBe(false);
  });
});

describe('hasVotingPhase', () => {
  it('returns true when any phase enables voting submission', () => {
    expect(
      hasVotingPhase([{ rules: {} }, { rules: { voting: { submit: true } } }]),
    ).toBe(true);
  });

  it('returns false when no phase enables voting submission', () => {
    expect(
      hasVotingPhase([{ rules: {} }, { rules: { voting: { submit: false } } }]),
    ).toBe(false);
  });

  it('returns false for phases with no rules', () => {
    expect(hasVotingPhase([{}, {}])).toBe(false);
  });

  it('returns false for an empty phases array', () => {
    expect(hasVotingPhase([])).toBe(false);
  });
});

describe('getPhaseReviewSettings', () => {
  it('returns defaults when neither phase rules nor config set anything', () => {
    const result = getPhaseReviewSettings(
      { phases: [{ phaseId: 'review' }] },
      'review',
    );

    expect(result).toEqual({
      submit: false,
      policy: 'full_coverage',
      scope: 'all',
      allowRevisions: true,
      anonymousFeedback: undefined,
      openReviews: false,
    });
  });

  it('resolves submit from reviews.submit or the legacy proposals.review flag', () => {
    const phases = [
      { phaseId: 'a', rules: { reviews: { submit: true } } },
      { phaseId: 'b', rules: { proposals: { review: true } } },
    ];

    expect(getPhaseReviewSettings({ phases }, 'a').submit).toBe(true);
    expect(getPhaseReviewSettings({ phases }, 'b').submit).toBe(true);
  });

  it('falls back to legacy config values when the phase has no reviews block', () => {
    const result = getPhaseReviewSettings(
      {
        config: {
          reviewsPolicy: 'full_coverage',
          reviewsAllowRevisions: false,
          reviewsAnonymousFeedback: true,
        },
        phases: [{ phaseId: 'review' }],
      },
      'review',
    );

    expect(result).toEqual({
      submit: false,
      policy: 'full_coverage',
      scope: 'all',
      allowRevisions: false,
      anonymousFeedback: true,
      openReviews: false,
    });
  });

  it('prefers the phase rules value over config and defaults', () => {
    const result = getPhaseReviewSettings(
      {
        config: {
          reviewsAllowRevisions: true,
          reviewsAnonymousFeedback: false,
        },
        phases: [
          {
            phaseId: 'review',
            rules: {
              reviews: {
                allowRevisions: false,
                anonymousFeedback: true,
              },
            },
          },
        ],
      },
      'review',
    );

    expect(result).toEqual({
      submit: false,
      policy: 'full_coverage',
      scope: 'all',
      allowRevisions: false,
      anonymousFeedback: true,
      openReviews: false,
    });
  });

  it('resolves each field independently — phase wins per field, config fills the rest', () => {
    const result = getPhaseReviewSettings(
      {
        config: {
          reviewsAllowRevisions: false,
          reviewsAnonymousFeedback: true,
        },
        phases: [
          {
            phaseId: 'review',
            // Phase only overrides allowRevisions; anonymousFeedback falls back
            // to config, policy falls all the way through to the default.
            rules: { reviews: { allowRevisions: true } },
          },
        ],
      },
      'review',
    );

    expect(result).toEqual({
      submit: false,
      policy: 'full_coverage',
      scope: 'all',
      allowRevisions: true,
      anonymousFeedback: true,
      openReviews: false,
    });
  });

  it('does not let a phase `false` fall through to a truthy config value', () => {
    const result = getPhaseReviewSettings(
      {
        config: { reviewsAllowRevisions: true },
        phases: [
          { phaseId: 'review', rules: { reviews: { allowRevisions: false } } },
        ],
      },
      'review',
    );

    expect(result.allowRevisions).toBe(false);
  });

  it('reads the matching phase, not the first one', () => {
    const result = getPhaseReviewSettings(
      {
        phases: [
          {
            phaseId: 'submission',
            rules: { reviews: { allowRevisions: false } },
          },
          {
            phaseId: 'review',
            rules: { reviews: { allowRevisions: true } },
          },
        ],
      },
      'review',
    );

    expect(result.allowRevisions).toBe(true);
  });

  it('throws when the phase is not configured on the instance', () => {
    expect(() =>
      getPhaseReviewSettings(
        {
          config: { reviewsAllowRevisions: false },
          phases: [{ phaseId: 'submission' }],
        },
        'review',
      ),
    ).toThrow();
  });

  it("defaults scope to 'all' when the phase has no review setting", () => {
    const result = getPhaseReviewSettings(
      { phases: [{ phaseId: 'review', rules: { reviews: { submit: true } } }] },
      'review',
    );

    expect(result.scope).toBe('all');
  });

  it('round-trips a saved phase-level scope (no legacy config fallback)', () => {
    const result = getPhaseReviewSettings(
      {
        phases: [
          {
            phaseId: 'review',
            rules: { reviews: { submit: true, scope: 'by_category' } },
          },
        ],
      },
      'review',
    );

    expect(result.scope).toBe('by_category');
  });

  it('defaults openReviews to false when the phase has no review setting', () => {
    const result = getPhaseReviewSettings(
      { phases: [{ phaseId: 'review', rules: { reviews: { submit: true } } }] },
      'review',
    );

    expect(result.openReviews).toBe(false);
  });

  it('resolves openReviews true from the phase rules', () => {
    const result = getPhaseReviewSettings(
      {
        phases: [
          {
            phaseId: 'review',
            rules: { reviews: { submit: true, openReviews: true } },
          },
        ],
      },
      'review',
    );

    expect(result.openReviews).toBe(true);
  });

  it('resolves openReviews false when explicitly set on the phase', () => {
    const result = getPhaseReviewSettings(
      {
        phases: [
          {
            phaseId: 'review',
            rules: { reviews: { submit: true, openReviews: false } },
          },
        ],
      },
      'review',
    );

    expect(result.openReviews).toBe(false);
  });

  it('never reads a legacy config counterpart for openReviews (phase-only)', () => {
    const result = getPhaseReviewSettings(
      {
        // A stray legacy-style flag must not leak into the phase-only resolution.
        config: { reviewsAllowRevisions: false },
        phases: [{ phaseId: 'review', rules: { reviews: { submit: true } } }],
      },
      'review',
    );

    expect(result.openReviews).toBe(false);
  });
});

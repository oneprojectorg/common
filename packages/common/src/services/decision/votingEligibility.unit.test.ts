import { describe, expect, it } from 'vitest';

import {
  VOTING_INELIGIBLE_STATUSES,
  isVotingEligible,
} from './votingEligibility';

describe('isVotingEligible', () => {
  it.each(['draft', 'rejected', 'duplicate'])(
    'returns false for ineligible status "%s"',
    (status) => {
      expect(isVotingEligible(status)).toBe(false);
    },
  );

  it.each(['submitted', 'shortlisted', 'under_review', 'approved', 'selected'])(
    'returns true for eligible status "%s"',
    (status) => {
      expect(isVotingEligible(status)).toBe(true);
    },
  );

  it('returns false for null', () => {
    expect(isVotingEligible(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isVotingEligible(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isVotingEligible('')).toBe(false);
  });

  it('returns true for unknown status strings', () => {
    expect(isVotingEligible('some_future_status')).toBe(true);
  });

  it('VOTING_INELIGIBLE_STATUSES contains exactly draft, rejected, duplicate', () => {
    expect(VOTING_INELIGIBLE_STATUSES).toEqual([
      'draft',
      'rejected',
      'duplicate',
    ]);
  });
});

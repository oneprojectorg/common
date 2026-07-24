import { describe, expect, it } from 'vitest';

import {
  type LeastReviewedSortItem,
  sortByLeastReviewed,
  stableRandomScore,
} from './reviewAssignmentSort';

function item(
  proposalId: string,
  completedReviewCount: number,
  isInProgress = false,
): LeastReviewedSortItem {
  return { proposalId, completedReviewCount, isInProgress };
}

describe('stableRandomScore', () => {
  it('returns a value in [0, 1)', () => {
    for (const seed of ['a', 'reviewer:proposal', '', '💡']) {
      const score = stableRandomScore(seed);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(stableRandomScore('reviewer-1:proposal-9')).toBe(
      stableRandomScore('reviewer-1:proposal-9'),
    );
  });

  it('differs across seeds', () => {
    expect(stableRandomScore('reviewer-1:p1')).not.toBe(
      stableRandomScore('reviewer-2:p1'),
    );
  });
});

describe('sortByLeastReviewed', () => {
  it('orders by fewest completed reviews first', () => {
    const result = sortByLeastReviewed(
      [item('a', 3), item('b', 0), item('c', 1)],
      'reviewer-1',
    );
    expect(result.map((r) => r.proposalId)).toEqual(['b', 'c', 'a']);
  });

  it('surfaces in-progress items first within the same review-count bucket', () => {
    const result = sortByLeastReviewed(
      [
        item('a', 0, false),
        item('b', 0, true),
        item('c', 0, false),
        item('reviewed', 2, true),
      ],
      'reviewer-1',
    );
    // `b` (in progress, 0 reviews) leads its bucket; `reviewed` stays last
    // because the review count dominates the in-progress preference.
    expect(result[0]?.proposalId).toBe('b');
    expect(result.at(-1)?.proposalId).toBe('reviewed');
  });

  it('breaks remaining ties deterministically for a given reviewer', () => {
    const items = [item('a', 0), item('b', 0), item('c', 0), item('d', 0)];
    const first = sortByLeastReviewed(items, 'reviewer-1').map(
      (r) => r.proposalId,
    );
    const second = sortByLeastReviewed(items, 'reviewer-1').map(
      (r) => r.proposalId,
    );
    expect(first).toEqual(second);
    // Still a permutation of the input, just reordered by the stable tiebreak.
    expect([...first].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('can order the same proposals differently for different reviewers', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`p${i}`, 0));
    const forReviewer1 = sortByLeastReviewed(items, 'reviewer-1').map(
      (r) => r.proposalId,
    );
    const forReviewer2 = sortByLeastReviewed(items, 'reviewer-2').map(
      (r) => r.proposalId,
    );
    expect(forReviewer1).not.toEqual(forReviewer2);
  });

  it('does not mutate the input array', () => {
    const items = [item('a', 2), item('b', 0)];
    const snapshot = [...items];
    sortByLeastReviewed(items, 'reviewer-1');
    expect(items).toEqual(snapshot);
  });
});

import { describe, expect, it } from 'vitest';

import type { AssignableProposal } from './insertReviewAssignments';
import { pickSingleReviewerAssignments } from './pickSingleReviewerAssignments';

/**
 * Ids are opaque to the picker, so readable stand-ins keep the expectations
 * legible. Candidate sets arrive author-free, hence no author here.
 */
function proposal(
  proposalId: string,
  reviewerProfileIds: string[],
): AssignableProposal {
  return {
    proposalId,
    submittedByProfileId: null,
    assignedProposalHistoryId: `${proposalId}-history`,
    reviewerProfileIds,
  };
}

/** proposalId → picked reviewers, for compact assertions. */
function picks(assignableProposals: AssignableProposal[]) {
  return new Map(
    assignableProposals.map((p) => [p.proposalId, p.reviewerProfileIds]),
  );
}

describe('pickSingleReviewerAssignments', () => {
  it('picks exactly one reviewer per proposal', () => {
    const result = pickSingleReviewerAssignments({
      assignableProposals: [
        proposal('p1', ['r1', 'r2', 'r3']),
        proposal('p2', ['r1', 'r2', 'r3']),
      ],
      existingAssignments: [],
    });

    for (const p of result.assignableProposals) {
      expect(p.reviewerProfileIds).toHaveLength(1);
    }
    expect(result.alreadyCoveredProposalIds).toEqual([]);
  });

  it('balances load across a shared candidate set to within one', () => {
    const reviewers = ['r1', 'r2', 'r3'];
    const result = pickSingleReviewerAssignments({
      assignableProposals: Array.from({ length: 7 }, (_, i) =>
        proposal(`p${i}`, reviewers),
      ),
      existingAssignments: [],
    });

    const counts = new Map<string, number>();
    for (const p of result.assignableProposals) {
      for (const reviewer of p.reviewerProfileIds) {
        counts.set(reviewer, (counts.get(reviewer) ?? 0) + 1);
      }
    }

    // 7 proposals over 3 reviewers → 3/2/2 in some order.
    expect([...counts.values()].sort()).toEqual([2, 2, 3]);
  });

  it('seeds load counters from existing rows so a mid-phase run keeps balancing', () => {
    // r1 already carries three assignments from earlier in the phase, so the two
    // new proposals must go to r2 and r3 — not back to r1.
    const result = pickSingleReviewerAssignments({
      assignableProposals: [
        proposal('p8', ['r1', 'r2', 'r3']),
        proposal('p9', ['r1', 'r2', 'r3']),
      ],
      existingAssignments: [
        { proposalId: 'p1', reviewerProfileId: 'r1' },
        { proposalId: 'p2', reviewerProfileId: 'r1' },
        { proposalId: 'p3', reviewerProfileId: 'r1' },
      ],
    });

    const assigned = result.assignableProposals.flatMap(
      (p) => p.reviewerProfileIds,
    );
    expect(assigned.sort()).toEqual(['r2', 'r3']);
  });

  it('leaves an empty candidate set unpicked', () => {
    const result = pickSingleReviewerAssignments({
      assignableProposals: [proposal('p1', [])],
      existingAssignments: [],
    });

    expect(picks(result.assignableProposals).get('p1')).toEqual([]);
    expect(result.alreadyCoveredProposalIds).toEqual([]);
  });

  it('skips a proposal that already has any assignment in the phase', () => {
    // The existing row belongs to r1; a re-run must not pick r2 "as well" —
    // onConflictDoNothing would happily insert that non-conflicting second row.
    const result = pickSingleReviewerAssignments({
      assignableProposals: [
        proposal('p1', ['r1', 'r2']),
        proposal('p2', ['r1', 'r2']),
      ],
      existingAssignments: [{ proposalId: 'p1', reviewerProfileId: 'r1' }],
    });

    expect(picks(result.assignableProposals).get('p1')).toEqual([]);
    expect(result.alreadyCoveredProposalIds).toEqual(['p1']);
    expect(picks(result.assignableProposals).get('p2')).toHaveLength(1);
  });

  it('is deterministic and independent of input order', () => {
    const reviewers = ['r1', 'r2', 'r3'];
    const proposals = Array.from({ length: 6 }, (_, i) =>
      proposal(`p${i}`, reviewers),
    );

    const first = picks(
      pickSingleReviewerAssignments({
        assignableProposals: proposals,
        existingAssignments: [],
      }).assignableProposals,
    );
    const reversed = picks(
      pickSingleReviewerAssignments({
        assignableProposals: [...proposals].reverse(),
        existingAssignments: [],
      }).assignableProposals,
    );

    // Same picks from a shuffled DB row order — the greedy walk sorts by id.
    expect([...reversed.entries()].sort()).toEqual([...first.entries()].sort());
  });
});

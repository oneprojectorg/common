import { describe, expect, it } from 'vitest';

import { applyCoveragePolicy } from './applyCoveragePolicy';
import type { AssignableProposal } from './insertReviewAssignments';

/**
 * Ids are opaque to the picker (it only compares them and hashes them), so
 * readable stand-ins keep the expectations legible.
 */
function proposal(
  proposalId: string,
  reviewerProfileIds: string[],
  submittedByProfileId: string | null = null,
): AssignableProposal {
  return {
    proposalId,
    submittedByProfileId,
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

describe('applyCoveragePolicy', () => {
  it('picks exactly one reviewer per proposal', () => {
    const result = applyCoveragePolicy({
      assignableProposals: [
        proposal('p1', ['r1', 'r2', 'r3']),
        proposal('p2', ['r1', 'r2', 'r3']),
      ],
      existingAssignments: [],
    });

    for (const p of result.assignableProposals) {
      expect(p.reviewerProfileIds).toHaveLength(1);
    }
    expect(result.zeroCandidateProposalIds).toEqual([]);
    expect(result.alreadyCoveredProposalIds).toEqual([]);
  });

  it('balances load across a shared candidate set to within one', () => {
    const reviewers = ['r1', 'r2', 'r3'];
    const result = applyCoveragePolicy({
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
    const result = applyCoveragePolicy({
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

  it('drops the author from the candidate set', () => {
    const result = applyCoveragePolicy({
      assignableProposals: [proposal('p1', ['r1', 'author'], 'author')],
      existingAssignments: [],
    });

    // Not left to insertReviewAssignments: a picked author would be filtered
    // downstream and the proposal would end up with no coverage at all.
    expect(picks(result.assignableProposals).get('p1')).toEqual(['r1']);
  });

  it('reports a zero-candidate proposal instead of assigning its author', () => {
    const result = applyCoveragePolicy({
      assignableProposals: [proposal('p1', ['author'], 'author')],
      existingAssignments: [],
    });

    expect(picks(result.assignableProposals).get('p1')).toEqual([]);
    expect(result.zeroCandidateProposalIds).toEqual(['p1']);
  });

  it('reports an empty candidate set as zero-candidate', () => {
    const result = applyCoveragePolicy({
      assignableProposals: [proposal('p1', [])],
      existingAssignments: [],
    });

    expect(result.zeroCandidateProposalIds).toEqual(['p1']);
  });

  it('skips a proposal that already has any assignment in the phase', () => {
    // The existing row belongs to r1; a re-run must not pick r2 "as well" —
    // onConflictDoNothing would happily insert that non-conflicting second row.
    const result = applyCoveragePolicy({
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
      applyCoveragePolicy({
        assignableProposals: proposals,
        existingAssignments: [],
      }).assignableProposals,
    );
    const reversed = picks(
      applyCoveragePolicy({
        assignableProposals: [...proposals].reverse(),
        existingAssignments: [],
      }).assignableProposals,
    );

    // Same picks from a shuffled DB row order — the greedy walk sorts by id.
    expect([...reversed.entries()].sort()).toEqual([...first.entries()].sort());
  });

  it('picks more than one reviewer when picksPerProposal is raised', () => {
    const result = applyCoveragePolicy({
      assignableProposals: [proposal('p1', ['r1', 'r2', 'r3'])],
      existingAssignments: [],
      picksPerProposal: 2,
    });

    const picked = picks(result.assignableProposals).get('p1')!;
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
  });

  it('caps picks at the candidate count and never duplicates a reviewer', () => {
    const result = applyCoveragePolicy({
      assignableProposals: [proposal('p1', ['r1', 'r1', 'r2'])],
      existingAssignments: [],
      picksPerProposal: 5,
    });

    expect(picks(result.assignableProposals).get('p1')?.sort()).toEqual([
      'r1',
      'r2',
    ]);
  });
});

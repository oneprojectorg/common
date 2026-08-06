import { createHash } from 'node:crypto';

import type { AssignableProposal } from './insertReviewAssignments';

/** An assignment row that already exists for the phase. */
export interface ExistingPhaseAssignment {
  proposalId: string;
  reviewerProfileId: string;
}

export interface ApplyCoveragePolicyInput {
  /**
   * The per-proposal candidate sets built by the caller — the same shape
   * `full_coverage` would insert wholesale (scope `all`: every eligible
   * reviewer; scope `by_category`: scope rows ∩ eligible).
   */
  assignableProposals: AssignableProposal[];
  /**
   * Every assignment row already in the (instance, phase). Drives both the
   * idempotency guard and the load counters.
   */
  existingAssignments: ExistingPhaseAssignment[];
  /**
   * Reviewers to pick per proposal. Kept parameterized for a future
   * "N reviewers per proposal" policy; not exposed above this helper in v1.
   */
  picksPerProposal?: number;
}

export interface ApplyCoveragePolicyResult {
  /**
   * Same proposals as the input, with the reviewer sets narrowed to the picks.
   * Skipped and uncoverable proposals carry an empty set, so passing the whole
   * list to `insertReviewAssignments` writes nothing for them.
   */
  assignableProposals: AssignableProposal[];
  /** Had no candidate at all (author-only, or an empty scope intersection). */
  zeroCandidateProposalIds: string[];
  /** Already had an assignment in the phase, so no new pick was made. */
  alreadyCoveredProposalIds: string[];
}

/**
 * Narrows per-proposal candidate reviewer sets down to the `single_reviewer`
 * policy: at most one assignment per proposal, balanced across reviewers and
 * deterministic. Pure — the caller does the reads, the writes, and the logging.
 *
 * Rules, in order:
 *  - **Idempotency guard.** A proposal that already has ANY assignment in the
 *    phase is skipped. `onConflictDoNothing` alone can't do this: a re-run that
 *    picked a different reviewer would insert a second, non-conflicting row.
 *  - **Author exclusion.** The author is dropped here, not left to
 *    `insertReviewAssignments` — a picked author would be filtered downstream
 *    and the proposal would end with zero coverage.
 *  - **Balanced load.** Greedy least-loaded pick with counters seeded from the
 *    existing rows, so mid-phase generation keeps building on the real load.
 *  - **Deterministic ties.** Broken by `md5(reviewerProfileId || proposalId)`,
 *    the stable hash the reviewer queue's shuffle already uses. No randomness,
 *    and no dependence on DB row order (proposals are processed id-ascending).
 */
export function applyCoveragePolicy({
  assignableProposals,
  existingAssignments,
  picksPerProposal = 1,
}: ApplyCoveragePolicyInput): ApplyCoveragePolicyResult {
  const coveredProposalIds = new Set(
    existingAssignments.map((row) => row.proposalId),
  );

  const loadByReviewer = new Map<string, number>();
  for (const row of existingAssignments) {
    loadByReviewer.set(
      row.reviewerProfileId,
      (loadByReviewer.get(row.reviewerProfileId) ?? 0) + 1,
    );
  }

  const zeroCandidateProposalIds: string[] = [];
  const alreadyCoveredProposalIds: string[] = [];

  // Id order makes the greedy walk independent of the order rows came back in.
  const orderedProposals = [...assignableProposals].sort((a, b) =>
    a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0,
  );

  const result = orderedProposals.map((proposal) => {
    const empty = { ...proposal, reviewerProfileIds: [] };

    if (coveredProposalIds.has(proposal.proposalId)) {
      alreadyCoveredProposalIds.push(proposal.proposalId);
      return empty;
    }

    const candidates = [...new Set(proposal.reviewerProfileIds)].filter(
      (reviewerProfileId) =>
        reviewerProfileId !== proposal.submittedByProfileId,
    );

    if (candidates.length === 0) {
      zeroCandidateProposalIds.push(proposal.proposalId);
      return empty;
    }

    const picked: string[] = [];
    const pool = new Set(candidates);
    const pickCount = Math.min(picksPerProposal, candidates.length);

    for (let i = 0; i < pickCount; i++) {
      const next = pickLeastLoaded({
        pool,
        proposalId: proposal.proposalId,
        loadByReviewer,
      });
      picked.push(next);
      pool.delete(next);
      loadByReviewer.set(next, (loadByReviewer.get(next) ?? 0) + 1);
    }

    return { ...proposal, reviewerProfileIds: picked };
  });

  return {
    assignableProposals: result,
    zeroCandidateProposalIds,
    alreadyCoveredProposalIds,
  };
}

/** Lowest current load wins; ties go to the lowest stable hash. */
function pickLeastLoaded({
  pool,
  proposalId,
  loadByReviewer,
}: {
  pool: Set<string>;
  proposalId: string;
  loadByReviewer: Map<string, number>;
}): string {
  let best: string | undefined;
  let bestLoad = Number.POSITIVE_INFINITY;
  let bestHash = '';

  for (const reviewerProfileId of pool) {
    const load = loadByReviewer.get(reviewerProfileId) ?? 0;
    if (load > bestLoad) {
      continue;
    }

    const hash = stableHash(reviewerProfileId, proposalId);
    if (best === undefined || load < bestLoad || hash < bestHash) {
      best = reviewerProfileId;
      bestLoad = load;
      bestHash = hash;
    }
  }

  // The caller only picks while the pool is non-empty.
  return best!;
}

/** Mirrors the SQL `md5(reviewerProfileId || proposalId)` tie-break. */
function stableHash(reviewerProfileId: string, proposalId: string): string {
  return createHash('md5')
    .update(`${reviewerProfileId}${proposalId}`)
    .digest('hex');
}

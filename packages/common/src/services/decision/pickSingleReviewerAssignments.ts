import { createHash } from 'node:crypto';

import type { AssignableProposal } from './insertReviewAssignments';

export interface ExistingPhaseAssignment {
  proposalId: string;
  reviewerProfileId: string;
}

export interface PickSingleReviewerAssignmentsInput {
  /**
   * Candidate sets built by the caller, author already excluded — a picked
   * author is dropped downstream and leaves the proposal uncovered.
   */
  assignableProposals: AssignableProposal[];
  /** Every assignment row already in the (instance, phase). */
  existingAssignments: ExistingPhaseAssignment[];
}

export interface PickSingleReviewerAssignmentsResult {
  /** Skipped and uncoverable proposals carry an empty set. */
  assignableProposals: AssignableProposal[];
  alreadyCoveredProposalIds: string[];
}

/**
 * Narrows candidate reviewer sets to the `single_reviewer` policy: one
 * balanced, deterministic pick per proposal. Pure — the caller reads, writes,
 * and logs.
 *
 * A proposal that already has ANY assignment in the phase is skipped;
 * `onConflictDoNothing` can't do that, since a re-run picking a different
 * reviewer would insert a second, non-conflicting row.
 */
export function pickSingleReviewerAssignments({
  assignableProposals,
  existingAssignments,
}: PickSingleReviewerAssignmentsInput): PickSingleReviewerAssignmentsResult {
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

    if (proposal.reviewerProfileIds.length === 0) {
      return empty;
    }

    const picked = pickLeastLoaded({
      candidates: proposal.reviewerProfileIds,
      proposalId: proposal.proposalId,
      loadByReviewer,
    });
    loadByReviewer.set(picked, (loadByReviewer.get(picked) ?? 0) + 1);

    return { ...proposal, reviewerProfileIds: [picked] };
  });

  return {
    assignableProposals: result,
    alreadyCoveredProposalIds,
  };
}

/** Lowest current load wins; ties go to the lowest stable hash. */
function pickLeastLoaded({
  candidates,
  proposalId,
  loadByReviewer,
}: {
  candidates: string[];
  proposalId: string;
  loadByReviewer: Map<string, number>;
}): string {
  let best: string | undefined;
  let bestLoad = Number.POSITIVE_INFINITY;
  let bestHash = '';

  for (const reviewerProfileId of candidates) {
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

  // The caller only picks from a non-empty candidate set.
  return best!;
}

/** Mirrors the SQL `md5(reviewerProfileId || proposalId)` tie-break. */
function stableHash(reviewerProfileId: string, proposalId: string): string {
  return createHash('md5')
    .update(`${reviewerProfileId}${proposalId}`)
    .digest('hex');
}

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

/**
 * Narrows candidate reviewer sets to the `single_reviewer` policy: one
 * balanced, deterministic pick per proposal. Pure — the caller reads and
 * writes. Skipped and uncoverable proposals come back with an empty set.
 *
 * A proposal that already has ANY assignment in the phase is skipped;
 * `onConflictDoNothing` can't do that, since a re-run picking a different
 * reviewer would insert a second, non-conflicting row.
 */
export function pickSingleReviewerAssignments({
  assignableProposals,
  existingAssignments,
}: PickSingleReviewerAssignmentsInput): AssignableProposal[] {
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

  // Id order makes the greedy walk independent of the order rows came back in.
  const orderedProposals = [...assignableProposals].sort((a, b) =>
    a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0,
  );

  return orderedProposals.map((proposal) => {
    if (
      coveredProposalIds.has(proposal.proposalId) ||
      proposal.reviewerProfileIds.length === 0
    ) {
      return { ...proposal, reviewerProfileIds: [] };
    }

    const picked = pickLeastLoaded({
      candidates: proposal.reviewerProfileIds,
      proposalId: proposal.proposalId,
      loadByReviewer,
    });
    loadByReviewer.set(picked, (loadByReviewer.get(picked) ?? 0) + 1);

    return { ...proposal, reviewerProfileIds: [picked] };
  });
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

/**
 * Equal load is the common case — every reviewer starts at 0 — and the candidate
 * sets arrive from queries with no `ORDER BY`, so without a tie-break the picks
 * would drift between runs on identical data. Hashing the pair (rather than
 * sorting on id) also stops the lowest-id reviewer always drawing the lowest-id
 * proposal, since the walk is already id-ascending. Same `md5(reviewer ||
 * proposal)` the reviewer queue's shuffle uses.
 */
function stableHash(reviewerProfileId: string, proposalId: string): string {
  return createHash('md5')
    .update(`${reviewerProfileId}${proposalId}`)
    .digest('hex');
}

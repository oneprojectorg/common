import { createHash } from 'node:crypto';

import { CommonError } from '../../utils';
import type { AssignableProposal } from './insertReviewAssignments';

interface ExistingPhaseAssignment {
  proposalId: string;
  reviewerProfileId: string;
}

interface PickSingleReviewerAssignmentsInput {
  /** Candidate sets built by the caller, author already excluded. */
  assignableProposals: AssignableProposal[];
  /** Every assignment row already in the (instance, phase). */
  existingAssignments: ExistingPhaseAssignment[];
}

/**
 * Narrows candidate reviewer sets to the `single_reviewer` policy: one
 * balanced, deterministic pick per proposal. Pure — the caller reads and
 * writes. Skipped and uncoverable proposals come back with an empty set.
 *
 * A proposal that already holds any assignment in the phase keeps it.
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
  const ranked = candidates.map((reviewerProfileId) => ({
    reviewerProfileId,
    load: loadByReviewer.get(reviewerProfileId) ?? 0,
    hash: stableHash(reviewerProfileId, proposalId),
  }));

  ranked.sort((a, b) => a.load - b.load || a.hash.localeCompare(b.hash));

  const [best] = ranked;
  if (!best) {
    throw new CommonError(
      `pickLeastLoaded: no candidates for proposal ${proposalId}`,
    );
  }

  return best.reviewerProfileId;
}

/**
 * Equal load is the common case — every reviewer starts at 0 — and the candidate
 * sets arrive from queries with no `ORDER BY`, so the tie-break is what keeps
 * the picks stable between runs on identical data. Hashing the pair also spreads
 * reviewers across proposals, which an id comparison wouldn't: the walk is
 * already id-ascending. Same `md5(reviewer || proposal)` as the queue shuffle.
 */
function stableHash(reviewerProfileId: string, proposalId: string): string {
  return createHash('md5')
    .update(`${reviewerProfileId}${proposalId}`)
    .digest('hex');
}

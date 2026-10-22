import type {
  AdminAssignableProposal,
  AdminDecisionReviewer,
  AdminEligibleReviewer,
} from '@op/common/client';

/** A reviewer row: the server rollup, or an eligible reviewer with no work yet. */
export type ReviewerRow = AdminDecisionReviewer & {
  label: string;
  email: string | null;
  /** False once the reviewer lost the REVIEW capability; history stays visible. */
  isEligible: boolean;
};

export interface ReviewerRows {
  rows: ReviewerRow[];
  reviewerIdsByProposalId: ReadonlyMap<string, string[]>;
  unassignedCount: number;
  /** Proposal id → number of reviewers who have submitted, across everyone. */
  submittedCountByProposalId: ReadonlyMap<string, number>;
}

/**
 * Rollups first (server-ordered), then eligible reviewers with nothing
 * assigned yet — no JS-side re-sort. Also inverts the rollups into
 * proposal → reviewers, which is what the assignment dialog needs, plus the
 * per-proposal submitted tally the reviewer detail screen shows on each card.
 */
export function buildReviewerRows(
  reviewers: AdminDecisionReviewer[],
  eligibleReviewers: AdminEligibleReviewer[],
  proposals: AdminAssignableProposal[],
): ReviewerRows {
  const rollupByProfileId = new Map(
    reviewers.map((reviewer) => [reviewer.profile.id, reviewer]),
  );
  const emailByProfileId = new Map(
    eligibleReviewers.map((reviewer) => [reviewer.id, reviewer.email]),
  );

  const rows: ReviewerRow[] = [
    ...reviewers.map((reviewer) => ({
      ...reviewer,
      label: reviewerLabel(reviewer.profile),
      email: emailByProfileId.get(reviewer.profile.id) ?? null,
      isEligible: emailByProfileId.has(reviewer.profile.id),
    })),
    ...eligibleReviewers
      .filter((reviewer) => !rollupByProfileId.has(reviewer.id))
      .map((reviewer) => ({
        profile: { id: reviewer.id, name: reviewer.name, slug: reviewer.slug },
        label: reviewerLabel(reviewer),
        email: reviewer.email,
        isEligible: true,
        assignedCount: 0,
        submittedCount: 0,
        draftCount: 0,
        lastSubmittedAt: null,
        assignments: [],
      })),
  ];

  const reviewerIdsByProposalId = new Map<string, string[]>();
  const submittedCountByProposalId = new Map<string, number>();
  for (const reviewer of reviewers) {
    for (const assignment of reviewer.assignments) {
      const existing = reviewerIdsByProposalId.get(assignment.proposalId);
      if (existing) {
        existing.push(reviewer.profile.id);
      } else {
        reviewerIdsByProposalId.set(assignment.proposalId, [
          reviewer.profile.id,
        ]);
      }

      if (assignment.reviewState === 'submitted') {
        submittedCountByProposalId.set(
          assignment.proposalId,
          (submittedCountByProposalId.get(assignment.proposalId) ?? 0) + 1,
        );
      }
    }
  }

  return {
    rows,
    reviewerIdsByProposalId,
    submittedCountByProposalId,
    unassignedCount: proposals.filter(
      (proposal) => !reviewerIdsByProposalId.has(proposal.id),
    ).length,
  };
}

function reviewerLabel(profile: {
  id: string;
  name: string | null;
  slug: string | null;
}): string {
  return profile.name ?? profile.slug ?? profile.id;
}

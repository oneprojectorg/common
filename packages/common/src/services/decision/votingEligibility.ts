/**
 * Voting eligibility rules — shared between frontend and backend.
 */
import { ProposalStatus } from '@op/db/schema';

/** Proposal statuses that are not eligible for voting. */
export const VOTING_INELIGIBLE_STATUSES: readonly string[] = [
  ProposalStatus.DRAFT,
  ProposalStatus.REJECTED,
  ProposalStatus.DUPLICATE,
];

/**
 * Proposal statuses that are excluded from the phase/review pipeline — the
 * selection, review, and results reads that resolve phase membership, plus the
 * transition-snapshot reads that feed them. Drafts were never in a phase;
 * rejected proposals have left it. Defined once so a future terminal status is
 * a one-line edit instead of a hunt across every phase predicate. (Voting layers
 * DUPLICATE on top — see VOTING_INELIGIBLE_STATUSES.)
 */
export const PIPELINE_INELIGIBLE_STATUSES: ProposalStatus[] = [
  ProposalStatus.DRAFT,
  ProposalStatus.REJECTED,
];

export function isVotingEligible(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return !VOTING_INELIGIBLE_STATUSES.includes(status);
}

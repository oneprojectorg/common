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

export function isVotingEligible(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return !VOTING_INELIGIBLE_STATUSES.includes(status);
}

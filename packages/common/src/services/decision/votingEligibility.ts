/**
 * Voting eligibility rules — client-safe (no server-only dependencies).
 * Shared between frontend and backend to keep the definition consistent.
 */

/** Proposal statuses that are not eligible for voting. */
export const VOTING_INELIGIBLE_STATUSES: readonly string[] = [
  'draft',
  'rejected',
  'duplicate',
];

export function isVotingEligible(status: string | null | undefined): boolean {
  if (!status) {
    return false;
  }
  return !VOTING_INELIGIBLE_STATUSES.includes(status);
}

import { getProfileIdsWithDecisionPermission } from './getProfileIdsWithDecisionPermission';
import { decisionPermission } from './permissions';

/**
 * Personal profile ids of every member currently holding the REVIEW
 * capability on the given decision profile. Shared by generation and backfill
 * so both resolve eligibility identically.
 */
export async function getEligibleReviewerProfileIds({
  decisionProfileId,
}: {
  decisionProfileId: string;
}): Promise<string[]> {
  return getProfileIdsWithDecisionPermission({
    decisionProfileId,
    permission: decisionPermission.REVIEW,
  });
}

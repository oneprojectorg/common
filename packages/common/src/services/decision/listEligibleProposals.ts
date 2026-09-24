import { and, asc, db, eq, isNull } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

import { isVotingEligible } from './votingEligibility';

export interface EligibleProposal {
  id: string;
  title: string;
}

/**
 * Proposals a member may currently vote for in a process instance.
 * Moderation-detached (CSAM) rows must never be votable, and neither may a
 * soft-deleted one, so both are excluded at query time rather than by a
 * post-fetch filter that could still leak the row to the eligibility check.
 *
 * Ordered by id, so a numbered list built from this result (an SMS ballot,
 * for instance) stays stable across separate calls as long as the underlying
 * set hasn't changed.
 */
export async function listEligibleProposals({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<EligibleProposal[]> {
  const rows = await db
    .select({
      id: proposals.id,
      status: proposals.status,
      title: profiles.name,
    })
    .from(proposals)
    .innerJoin(profiles, eq(profiles.id, proposals.profileId))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    )
    .orderBy(asc(proposals.id));

  return rows
    .filter((row) => isVotingEligible(row.status))
    .map(({ id, title }) => ({ id, title }));
}

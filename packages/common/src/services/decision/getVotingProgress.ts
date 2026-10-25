import { and, count, db, eq, inArray } from '@op/db/client';
import { decisionsVoteSubmissions } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getInstance } from './getInstance';
import { computeDaysLeft } from './getPhaseReviewProgress';
import { getProfileIdsWithDecisionPermission } from './getProfileIdsWithDecisionPermission';
import { decisionPermission } from './permissions';
import type { VotingProgress } from './schemas/votingProgress';

export async function getVotingProgress({
  user,
  processInstanceId,
}: {
  user: User;
  processInstanceId: string;
}): Promise<VotingProgress> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  // Mirrors the permissions submitVote admits.
  const eligibleProfileIds = await getProfileIdsWithDecisionPermission({
    decisionProfileId: instance.profileId,
    permission: permission.ADMIN | decisionPermission.VOTE,
  });

  const participantsVotedCount = await getVotedCount({
    processInstanceId,
    profileIds: eligibleProfileIds,
  });
  const participantsEligibleCount = eligibleProfileIds.length;

  return {
    participantsVotedCount,
    participantsEligibleCount,
    turnoutPercentage:
      participantsEligibleCount === 0
        ? 0
        : Math.round(
            (participantsVotedCount / participantsEligibleCount) * 100,
          ),
    daysLeft: instance.currentStateId
      ? computeDaysLeft({
          phaseId: instance.currentStateId,
          phases: instance.instanceData.phases,
        })
      : null,
  };
}

// Counts only eligible voters, so a member who voted and then lost the vote
// permission cannot push turnout past 100%.
async function getVotedCount({
  processInstanceId,
  profileIds,
}: {
  processInstanceId: string;
  profileIds: string[];
}): Promise<number> {
  if (profileIds.length === 0) {
    return 0;
  }

  const [row] = await db
    .select({ count: count() })
    .from(decisionsVoteSubmissions)
    .where(
      and(
        eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
        inArray(decisionsVoteSubmissions.submittedByProfileId, profileIds),
      ),
    );

  return row?.count ?? 0;
}

import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { getCachedInstance } from './getCachedInstance';
import { computeDaysLeft } from './getPhaseReviewProgress';
import { getProfileIdsWithDecisionPermission } from './getProfileIdsWithDecisionPermission';
import { isDecisionPublic } from './isDecisionPublic';
import { decisionPermission } from './permissions';
import { assertDecisionAdmin } from './phaseHelpers';
import { getInstancePhases } from './schemas/instanceData';
import type { VotingProgress } from './schemas/votingProgress';

// The permissions submitVote admits.
const VOTE_PERMISSIONS = [
  { decisions: permission.ADMIN },
  { decisions: decisionPermission.VOTE },
];

export async function getVotingProgress({
  user,
  processInstanceId,
}: {
  user: User;
  processInstanceId: string;
}): Promise<VotingProgress> {
  const instance = await getCachedInstance(processInstanceId);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  // The reads run beside the assert; a denied caller gets its rejection and
  // never sees their results.
  const [, memberProfileIds, isPublicVoting, voterProfileIds] =
    await Promise.all([
      assertDecisionAdmin({ user, decisionProfileId: instance.profileId }),
      instance.profileId
        ? getProfileIdsWithDecisionPermission({
            decisionProfileId: instance.profileId,
            permission: permission.ADMIN | decisionPermission.VOTE,
          })
        : [],
      instance.profileId
        ? isDecisionPublic({
            profileId: instance.profileId,
            permissions: VOTE_PERMISSIONS,
          })
        : false,
      getVoterProfileIds({ processInstanceId }),
    ]);

  // Public voting admits every voter; otherwise a voter who lost the vote
  // permission is not counted, so turnout stays at most 100%.
  const eligibleProfileIds = new Set(memberProfileIds);
  if (isPublicVoting) {
    voterProfileIds.forEach((id) => eligibleProfileIds.add(id));
  }
  const participantsVotedCount = voterProfileIds.filter((id) =>
    eligibleProfileIds.has(id),
  ).length;
  const participantsEligibleCount = eligibleProfileIds.size;

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
          phases: getInstancePhases(instance.instanceData),
        })
      : null,
  };
}

// One row per voter: submissions are unique per instance and profile.
async function getVoterProfileIds({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<string[]> {
  const submissions = await db.query.decisionsVoteSubmissions.findMany({
    where: { processInstanceId },
    columns: { submittedByProfileId: true },
  });

  return submissions.map((submission) => submission.submittedByProfileId);
}

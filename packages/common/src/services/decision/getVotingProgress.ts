import { db } from '@op/db/client';
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
  const [{ profileIds, includesPublic }, voterProfileIds] = await Promise.all([
    getProfileIdsWithDecisionPermission({
      decisionProfileId: instance.profileId,
      permission: permission.ADMIN | decisionPermission.VOTE,
    }),
    getVoterProfileIds({ processInstanceId }),
  ]);

  // With public voting every caller can vote, so every ballot counts and its
  // voter joins the eligible members. Otherwise a member who voted and then
  // lost the vote permission is not counted, so turnout stays at most 100%.
  const eligibleProfileIds = new Set(profileIds);
  const countedVoterProfileIds = includesPublic
    ? voterProfileIds
    : voterProfileIds.filter((id) => eligibleProfileIds.has(id));
  if (includesPublic) {
    voterProfileIds.forEach((id) => eligibleProfileIds.add(id));
  }

  const participantsVotedCount = countedVoterProfileIds.length;
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
          phases: instance.instanceData.phases,
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

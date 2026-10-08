import { and, db, eq, isNull } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { isSingleChoiceVotingPhase } from './utils/phaseSettings';
import { isVotingEligible } from './votingEligibility';

export interface SingleChoiceBallotProposal {
  id: string;
}

export async function findSingleChoiceBallotProposal({
  processInstanceId,
  phase,
}: {
  processInstanceId: string;
  phase:
    | { rules?: { voting?: { submit?: boolean; maxVotesPerMember?: number } } }
    | undefined;
}): Promise<SingleChoiceBallotProposal | null> {
  if (!phase || !isSingleChoiceVotingPhase(phase)) {
    return null;
  }

  const rows = await db
    .select({ id: proposals.id, status: proposals.status })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    );

  const eligible = rows.filter((row) => isVotingEligible(row.status));

  return eligible.length === 1 && eligible[0] ? { id: eligible[0].id } : null;
}

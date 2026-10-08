import { and, db, eq, isNull } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { isVotingPhase } from './utils/phaseSettings';
import { isVotingEligible } from './votingEligibility';

export interface SmsVotableProposal {
  id: string;
}

export async function findSmsVotableProposal({
  processInstanceId,
  phase,
}: {
  processInstanceId: string;
  phase: { rules?: { voting?: { submit?: boolean } } } | undefined;
}): Promise<SmsVotableProposal | null> {
  if (!phase || !isVotingPhase(phase)) {
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

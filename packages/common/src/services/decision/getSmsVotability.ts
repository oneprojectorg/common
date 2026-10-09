import { and, db, eq, isNull } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { isVotingPhase } from './utils/phaseSettings';
import { isVotingEligible } from './votingEligibility';

export interface SmsVotability {
  votingOpen: boolean;
  eligibleProposalCount: number;
  maxVotesPerMember: number | null;
}

export async function getSmsVotability({
  processInstanceId,
  phase,
}: {
  processInstanceId: string;
  phase:
    | { rules?: { voting?: { submit?: boolean; maxVotesPerMember?: number } } }
    | undefined;
}): Promise<SmsVotability> {
  const votingOpen = phase ? isVotingPhase(phase) : false;
  const maxVotesPerMember = phase?.rules?.voting?.maxVotesPerMember ?? null;

  if (!votingOpen) {
    return { votingOpen, eligibleProposalCount: 0, maxVotesPerMember };
  }

  const rows = await db
    .select({ status: proposals.status })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    );

  return {
    votingOpen,
    eligibleProposalCount: rows.filter((row) => isVotingEligible(row.status))
      .length,
    maxVotesPerMember,
  };
}

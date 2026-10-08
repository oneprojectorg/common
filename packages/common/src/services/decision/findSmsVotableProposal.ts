import { and, db, eq, isNull } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { isVotingPhase } from './utils/phaseSettings';
import { isVotingEligible } from './votingEligibility';

export interface SmsVotability {
  proposalId: string | null;
  votingOpen: boolean;
  eligibleProposalCount: number;
}

export async function findSmsVotableProposal({
  processInstanceId,
  phase,
}: {
  processInstanceId: string;
  phase: { rules?: { voting?: { submit?: boolean } } } | undefined;
}): Promise<SmsVotability> {
  const votingOpen = phase ? isVotingPhase(phase) : false;

  if (!votingOpen) {
    return { proposalId: null, votingOpen, eligibleProposalCount: 0 };
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
  const only = eligible.length === 1 ? eligible[0] : undefined;

  return {
    proposalId: only?.id ?? null,
    votingOpen,
    eligibleProposalCount: eligible.length,
  };
}

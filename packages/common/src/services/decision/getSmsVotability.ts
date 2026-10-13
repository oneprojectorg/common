import { count, db } from '@op/db/client';
import { proposals } from '@op/db/schema';

import { buildSmsBallotProposalFilter } from './smsBallotScope';
import { isVotingPhase } from './utils/phaseSettings';

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

  const filter = await buildSmsBallotProposalFilter({ processInstanceId });

  if (!filter) {
    return { votingOpen, eligibleProposalCount: 0, maxVotesPerMember };
  }

  const [row] = await db
    .select({ eligibleProposalCount: count() })
    .from(proposals)
    .where(filter);

  return {
    votingOpen,
    eligibleProposalCount: row?.eligibleProposalCount ?? 0,
    maxVotesPerMember,
  };
}

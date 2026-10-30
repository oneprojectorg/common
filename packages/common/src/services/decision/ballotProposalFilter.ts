import { type SQL, and, eq } from '@op/db/client';
import { proposals } from '@op/db/schema';

import {
  type PhaseScopedInstance,
  getPhaseProposalSqlScope,
} from './getProposalsForPhase';
import { votingEligiblePredicate } from './phaseEligibility';
import { isReadableByEveryone } from './proposalVisibility';

export interface BallotProposalFilter {
  isEmpty: boolean;
  where: (t: typeof proposals) => SQL | undefined;
}

export async function ballotProposalFilter({
  instance,
}: {
  instance: PhaseScopedInstance;
}): Promise<BallotProposalFilter> {
  const scope = await getPhaseProposalSqlScope({ instance, authUserIds: [] });

  return {
    isEmpty: scope.isEmpty,
    where: (t) =>
      and(
        eq(t.processInstanceId, instance.id),
        isReadableByEveryone(t),
        votingEligiblePredicate(t),
        scope.buildNonDraftFilter(t),
      ),
  };
}

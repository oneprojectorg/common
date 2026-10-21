import { and, count, db, eq } from '@op/db/client';
import { proposals } from '@op/db/schema';

import {
  type PhaseScopedInstance,
  getPhaseProposalSqlScope,
} from './getProposalsForPhase';
import { votingEligiblePredicate } from './phaseEligibility';
import { isReadableByEveryone } from './proposalVisibility';

export async function countBallotProposals({
  instance,
}: {
  instance: PhaseScopedInstance;
}): Promise<number> {
  const scope = await getPhaseProposalSqlScope({ instance, authUserIds: [] });

  if (scope.isEmpty) {
    return 0;
  }

  const [row] = await db
    .select({ total: count() })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instance.id),
        isReadableByEveryone(proposals),
        votingEligiblePredicate(proposals),
        scope.buildNonDraftFilter(proposals),
      ),
    );

  return row?.total ?? 0;
}

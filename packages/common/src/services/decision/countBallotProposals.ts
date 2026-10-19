import { and, count, db, eq } from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';

import { getPhaseProposalSqlScope } from './getProposalsForPhase';
import { votingEligiblePredicate } from './phaseEligibility';
import { isReadableByEveryone } from './proposalVisibility';

export async function countBallotProposals({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<number> {
  const [instance] = await db
    .select({
      id: processInstances.id,
      instanceData: processInstances.instanceData,
      currentStateId: processInstances.currentStateId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instance) {
    return 0;
  }

  const scope = await getPhaseProposalSqlScope({ instance, authUserIds: [] });

  if (scope.isEmpty) {
    return 0;
  }

  const [row] = await db
    .select({ total: count() })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isReadableByEveryone(proposals),
        votingEligiblePredicate(proposals),
        scope.buildNonDraftFilter(proposals),
      ),
    );

  return row?.total ?? 0;
}

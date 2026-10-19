import { type SQL, and, db, eq } from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';

import { getPhaseProposalSqlScope } from './getProposalsForPhase';
import { votingEligiblePredicate } from './phaseEligibility';
import { isReadableByEveryone } from './proposalVisibility';

export async function buildBallotProposalFilter({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<SQL | null> {
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
    return null;
  }

  const scope = await getPhaseProposalSqlScope({ instance, authUserIds: [] });

  if (scope.isEmpty) {
    return null;
  }

  const filter = and(
    eq(proposals.processInstanceId, processInstanceId),
    isReadableByEveryone(proposals),
    votingEligiblePredicate(proposals),
    scope.buildNonDraftFilter(proposals),
  );

  return filter ?? null;
}

import { type SQL, and, db, eq, notInArray, sql } from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';

import { getPhaseProposalSqlScope } from './getProposalsForPhase';
import { notSuperseded } from './proposalSupersession';
import { isReadableByEveryone } from './proposalVisibility';
import { VOTING_INELIGIBLE_STATUSES } from './votingEligibility';

export async function buildSmsBallotProposalFilter({
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

  return and(
    eq(proposals.processInstanceId, processInstanceId),
    isReadableByEveryone(proposals),
    notInArray(sql<string>`${proposals.status}::text`, [
      ...VOTING_INELIGIBLE_STATUSES,
    ]),
    notSuperseded({ proposalId: proposals.id, processInstanceId }),
    scope.buildNonDraftFilter(proposals),
  )!;
}

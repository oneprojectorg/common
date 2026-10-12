import { type DbClient, and, desc, eq, inArray } from '@op/db/client';
import { decisionTransitionProposals, proposalHistory } from '@op/db/schema';

import { CommonError } from '../../utils';

/**
 * Attaches proposals to a phase's inbound transition, each pinned to its
 * latest history snapshot. This attachment is what puts a proposal in the
 * phase — see `getProposalsForPhase`.
 */
export async function attachProposalsToTransition({
  dbClient,
  processInstanceId,
  transitionHistoryId,
  proposalIds,
}: {
  dbClient: DbClient;
  processInstanceId: string;
  transitionHistoryId: string;
  proposalIds: string[];
}): Promise<void> {
  if (proposalIds.length === 0) {
    return;
  }

  const latestHistoryRows = await dbClient
    .selectDistinctOn([proposalHistory.id], {
      proposalId: proposalHistory.id,
      historyId: proposalHistory.historyId,
    })
    .from(proposalHistory)
    .where(
      and(
        eq(proposalHistory.processInstanceId, processInstanceId),
        inArray(proposalHistory.id, proposalIds),
      ),
    )
    .orderBy(proposalHistory.id, desc(proposalHistory.historyCreatedAt));

  if (latestHistoryRows.length !== proposalIds.length) {
    throw new CommonError(
      `Proposals missing history records for instance ${processInstanceId}: expected ${proposalIds.length}, got ${latestHistoryRows.length}`,
    );
  }

  await dbClient.insert(decisionTransitionProposals).values(
    latestHistoryRows.map(({ proposalId, historyId }) => ({
      processInstanceId,
      transitionHistoryId,
      proposalId,
      proposalHistoryId: historyId,
    })),
  );
}

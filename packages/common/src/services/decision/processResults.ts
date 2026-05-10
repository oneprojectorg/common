import { type DbClient, count, db, eq } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteSubmissions,
} from '@op/db/schema';

import { CommonError } from '../../utils';
import { getProposalsForPhase } from './getProposalsForPhase';

/**
 * Persist the proposals attached to the current phase as the decision's
 * selections. Append-only: each run inserts a new `decision_process_results`
 * row; readers pick the latest by `executedAt`. Pass `tx` to run inline in a
 * caller's transaction; otherwise this manages its own and stamps a failure
 * row on uncaught errors.
 */
export async function processResults({
  processInstanceId,
  tx,
}: {
  processInstanceId: string;
  tx?: DbClient;
}): Promise<void> {
  if (tx) {
    await runProcessResults(tx, processInstanceId);
    return;
  }

  try {
    await db.transaction(async (newTx) =>
      runProcessResults(newTx, processInstanceId),
    );
  } catch (error) {
    console.error('Error processing results:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    try {
      const voterCount = await fetchVoterCount(db, processInstanceId);
      await db.transaction(async (failureTx) =>
        writeResultRow({
          tx: failureTx,
          processInstanceId,
          errorMessage,
          selectedProposalIds: [],
          voterCount,
        }),
      );
    } catch (insertError) {
      console.error('Failed to store error in database:', insertError);
    }

    throw new CommonError(`Failed to process results: ${errorMessage}`);
  }
}

async function runProcessResults(
  tx: DbClient,
  processInstanceId: string,
): Promise<void> {
  const [processProposals, voterCount] = await Promise.all([
    getProposalsForPhase({ instanceId: processInstanceId, db: tx }),
    fetchVoterCount(tx, processInstanceId),
  ]);

  await writeResultRow({
    tx,
    processInstanceId,
    errorMessage: null,
    selectedProposalIds: processProposals.map((p) => p.id),
    voterCount,
  });
}

async function fetchVoterCount(
  dbOrTx: DbClient,
  processInstanceId: string,
): Promise<number> {
  const rows = await dbOrTx
    .select({ count: count() })
    .from(decisionsVoteSubmissions)
    .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));
  return rows[0]?.count ?? 0;
}

async function writeResultRow({
  tx,
  processInstanceId,
  errorMessage,
  selectedProposalIds,
  voterCount,
}: {
  tx: DbClient;
  processInstanceId: string;
  errorMessage: string | null;
  selectedProposalIds: string[];
  voterCount: number;
}): Promise<void> {
  const [row] = await tx
    .insert(decisionProcessResults)
    .values({
      processInstanceId,
      success: errorMessage === null,
      errorMessage,
      selectedCount: selectedProposalIds.length,
      voterCount,
      pipelineConfig: null,
    })
    .returning({ id: decisionProcessResults.id });

  if (!row) {
    throw new CommonError('Failed to insert process result record');
  }

  if (selectedProposalIds.length > 0) {
    await tx.insert(decisionProcessResultSelections).values(
      selectedProposalIds.map((proposalId) => ({
        processResultId: row.id,
        proposalId,
        selectionRank: 0,
      })),
    );
  }
}

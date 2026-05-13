import { type DbClient, count, db, eq } from '@op/db/client';
import {
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteSubmissions,
  processInstances,
} from '@op/db/schema';

import { CommonError, NotFoundError } from '../../utils';
import {
  type PhaseScopedInstance,
  getProposalIdsForPhase,
} from './getProposalsForPhase';

/**
 * Persist the proposals attached to the current phase as the decision's
 * selections. Append-only: each run inserts a new `decision_process_results`
 * row; readers pick the latest by `executedAt`. Pass `tx` to run inline in a
 * caller's transaction; otherwise this manages its own and stamps a failure
 * row on uncaught errors. Pass `instance` when the caller already loaded the
 * row (e.g. inside a locking tx) to skip a redundant fetch.
 */
export async function processResults({
  processInstanceId,
  tx,
  instance,
}: {
  processInstanceId: string;
  tx?: DbClient;
  instance?: PhaseScopedInstance;
}): Promise<void> {
  if (tx) {
    await runProcessResults({
      tx,
      processInstanceId,
      preloadedInstance: instance,
    });
    return;
  }

  try {
    await db.transaction(async (newTx) =>
      runProcessResults({
        tx: newTx,
        processInstanceId,
        preloadedInstance: instance,
      }),
    );
  } catch (error) {
    console.error('Error processing results:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    try {
      const voterCount = await fetchVoterCount({ db, processInstanceId });
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

async function runProcessResults({
  tx,
  processInstanceId,
  preloadedInstance,
}: {
  tx: DbClient;
  processInstanceId: string;
  preloadedInstance?: PhaseScopedInstance;
}): Promise<void> {
  const resolvedInstance =
    preloadedInstance ??
    (await loadPhaseScopedInstance({ db: tx, processInstanceId }));

  if (!resolvedInstance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const [selectedProposalIds, voterCount] = await Promise.all([
    getProposalIdsForPhase({ instance: resolvedInstance, db: tx }),
    fetchVoterCount({ db: tx, processInstanceId }),
  ]);

  await writeResultRow({
    tx,
    processInstanceId,
    errorMessage: null,
    selectedProposalIds,
    voterCount,
  });
}

async function loadPhaseScopedInstance({
  db,
  processInstanceId,
}: {
  db: DbClient;
  processInstanceId: string;
}): Promise<PhaseScopedInstance | undefined> {
  const [row] = await db
    .select({
      id: processInstances.id,
      instanceData: processInstances.instanceData,
      currentStateId: processInstances.currentStateId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);
  return row;
}

async function fetchVoterCount({
  db,
  processInstanceId,
}: {
  db: DbClient;
  processInstanceId: string;
}): Promise<number> {
  const rows = await db
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

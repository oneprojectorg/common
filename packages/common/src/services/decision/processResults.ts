import { type DbClient, and, count, db, eq, inArray, notInArray } from '@op/db/client';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteSubmissions,
  processInstances,
  proposals,
} from '@op/db/schema';

import { CommonError } from '../../utils';
import { getProposalsForPhase } from './getProposalsForPhase';

/**
 * Record the proposals that advanced into the current (final) phase as the
 * decision's selections. Selection itself happens upstream — the prior phase's
 * pipeline (or admin manual selection) decides what advances; we just persist
 * that set so the Results screen can read it.
 *
 * Pass `tx` to run inline in a caller's transaction (atomic with whatever
 * upstream write produced the inbound attachments — e.g. submitManualSelection).
 * Errors propagate so the caller's transaction rolls back. When `tx` is omitted,
 * processResults manages its own transaction and stamps a failure row on
 * uncaught errors so the Results screen can surface that the run failed.
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
        recordUnexpectedFailure({
          tx: failureTx,
          processInstanceId,
          errorMessage,
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
  const [instance] = await tx
    .select({ id: processInstances.id })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instance) {
    throw new CommonError(`Process instance not found: ${processInstanceId}`);
  }

  const processProposals = await getProposalsForPhase({
    instanceId: processInstanceId,
    db: tx,
  });
  const selectedProposalIds = processProposals.map((p) => p.id);

  const voterCount = await fetchVoterCount(tx, processInstanceId);

  await upsertResultRecord({
    tx,
    processInstanceId,
    selectedProposalIds,
    voterCount,
  });

  // Reset only the diff: any proposal previously marked SELECTED for this
  // instance that's no longer in the current selection set gets reverted to
  // APPROVED so proposals.status stays in sync with decision_process_result_selections.
  const staleSelectedCondition =
    selectedProposalIds.length > 0
      ? and(
          eq(proposals.processInstanceId, processInstanceId),
          eq(proposals.status, ProposalStatus.SELECTED),
          notInArray(proposals.id, selectedProposalIds),
        )
      : and(
          eq(proposals.processInstanceId, processInstanceId),
          eq(proposals.status, ProposalStatus.SELECTED),
        );

  await tx
    .update(proposals)
    .set({ status: ProposalStatus.APPROVED })
    .where(staleSelectedCondition);

  if (selectedProposalIds.length > 0) {
    await tx
      .update(proposals)
      .set({ status: ProposalStatus.SELECTED })
      .where(inArray(proposals.id, selectedProposalIds));
  }
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

/**
 * Atomic upsert keyed on processInstanceId (UNIQUE in the DB). Replaces
 * selections to match the current set of proposals advancing into the final
 * phase.
 */
async function upsertResultRecord({
  tx,
  processInstanceId,
  selectedProposalIds,
  voterCount,
}: {
  tx: DbClient;
  processInstanceId: string;
  selectedProposalIds: string[];
  voterCount: number;
}): Promise<void> {
  const [row] = await tx
    .insert(decisionProcessResults)
    .values({
      processInstanceId,
      success: true,
      errorMessage: null,
      selectedCount: selectedProposalIds.length,
      voterCount,
      pipelineConfig: null,
    })
    .onConflictDoUpdate({
      target: decisionProcessResults.processInstanceId,
      set: {
        success: true,
        errorMessage: null,
        selectedCount: selectedProposalIds.length,
        voterCount,
        pipelineConfig: null,
        executedAt: new Date().toISOString(),
      },
    })
    .returning({ id: decisionProcessResults.id });

  if (!row) {
    throw new CommonError('Failed to upsert process result record');
  }
  const resultId = row.id;

  await tx
    .delete(decisionProcessResultSelections)
    .where(eq(decisionProcessResultSelections.processResultId, resultId));

  if (selectedProposalIds.length > 0) {
    await tx.insert(decisionProcessResultSelections).values(
      selectedProposalIds.map((proposalId) => ({
        processResultId: resultId,
        proposalId,
        selectionRank: 0,
      })),
    );
  }
}

/**
 * Outer-catch fallback: an unexpected error happened before the selection set
 * could be persisted (DB read failure, instance lookup, etc). Stamp the
 * failure on the result row but preserve any existing selections — we don't
 * have a new authoritative state to replace them with, so destroying the
 * prior run's data on a transient infra failure would lose information.
 */
async function recordUnexpectedFailure({
  tx,
  processInstanceId,
  errorMessage,
  voterCount,
}: {
  tx: DbClient;
  processInstanceId: string;
  errorMessage: string;
  voterCount: number;
}): Promise<void> {
  const [row] = await tx
    .insert(decisionProcessResults)
    .values({
      processInstanceId,
      success: false,
      errorMessage,
      selectedCount: 0,
      voterCount,
      pipelineConfig: null,
    })
    .onConflictDoUpdate({
      target: decisionProcessResults.processInstanceId,
      set: {
        success: false,
        errorMessage,
        executedAt: new Date().toISOString(),
      },
    })
    .returning({ id: decisionProcessResults.id });

  if (!row) {
    throw new CommonError('Failed to record processing failure');
  }
}

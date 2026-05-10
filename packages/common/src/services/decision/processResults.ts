import { type DbClient, count, db, eq, inArray } from '@op/db/client';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteSubmissions,
  proposals,
} from '@op/db/schema';

import { CommonError } from '../../utils';
import { getProposalsForPhase } from './getProposalsForPhase';
import type { DecisionInstanceData } from './schemas/instanceData';
import {
  aggregateProposalMetrics,
  defaultSelectionPipeline,
  executeSelectionPipeline,
} from './selectionPipeline';
import type {
  ExecutionContext,
  SelectionPipeline,
} from './selectionPipeline/types';

/** Execute the selection pipeline and store winning proposals. */
export async function processResults({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<{
  success: boolean;
  resultId: string;
  selectedProposalIds: string[];
  error?: string;
}> {
  try {
    const processInstance = await db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      with: {
        process: true,
      },
    });

    if (!processInstance) {
      throw new CommonError(`Process instance not found: ${processInstanceId}`);
    }

    if (!processInstance.process) {
      throw new CommonError(
        `Process not found for instance: ${processInstanceId}`,
      );
    }

    const instanceData = processInstance.instanceData as DecisionInstanceData;
    const currentPhaseId = processInstance.currentStateId;

    const processProposals = await getProposalsForPhase({
      instanceId: processInstanceId,
    });

    const currentPhase = instanceData.phases?.find(
      (p) => p.phaseId === currentPhaseId,
    );
    const pipeline =
      currentPhase?.selectionPipeline ?? defaultSelectionPipeline;

    let selectedProposalIds: string[] = [];
    let error: string | undefined;
    let success = false;

    try {
      const proposalMetrics = await aggregateProposalMetrics(processProposals);
      const context: ExecutionContext = {
        proposals: processProposals,
        voteData: proposalMetrics,
        variables: {},
        outputs: {},
      };

      const selectedProposals = await executeSelectionPipeline(
        pipeline,
        context,
      );
      selectedProposalIds = selectedProposals.map((p) => p.id);
      success = true;
    } catch (err) {
      console.error('Error executing selection pipeline:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const voterCount = await fetchVoterCount(processInstanceId);

    const result = await db.transaction(async (tx) => {
      const { resultId } = await upsertResultRecord({
        tx,
        processInstanceId,
        success,
        errorMessage: error,
        selectedProposalIds,
        voterCount,
        pipelineConfig: pipeline === defaultSelectionPipeline ? null : pipeline,
      });

      if (selectedProposalIds.length > 0) {
        await tx
          .update(proposals)
          .set({ status: ProposalStatus.SELECTED })
          .where(inArray(proposals.id, selectedProposalIds));
      }

      return {
        success,
        resultId,
        selectedProposalIds,
        error,
      };
    });

    return result;
  } catch (error) {
    console.error('Error processing results:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    try {
      const voterCount = await fetchVoterCount(processInstanceId);

      const { resultId } = await db.transaction(async (tx) =>
        recordUnexpectedFailure({
          tx,
          processInstanceId,
          errorMessage,
          voterCount,
        }),
      );

      return {
        success: false,
        resultId,
        selectedProposalIds: [],
        error: errorMessage,
      };
    } catch (insertError) {
      console.error('Failed to store error in database:', insertError);
    }

    throw new CommonError(`Failed to process results: ${errorMessage}`);
  }
}

async function fetchVoterCount(processInstanceId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(decisionsVoteSubmissions)
    .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));
  return rows[0]?.count ?? 0;
}

/**
 * Atomic upsert keyed on processInstanceId (UNIQUE in the DB). Replaces
 * selections to match the new run. Used after a real pipeline execution —
 * success or pipeline-level failure — where the empty selection set is the
 * authoritative current state.
 */
async function upsertResultRecord({
  tx,
  processInstanceId,
  success,
  errorMessage,
  selectedProposalIds,
  voterCount,
  pipelineConfig,
}: {
  tx: DbClient;
  processInstanceId: string;
  success: boolean;
  errorMessage: string | undefined;
  selectedProposalIds: string[];
  voterCount: number;
  pipelineConfig: SelectionPipeline | null;
}): Promise<{ resultId: string }> {
  const [row] = await tx
    .insert(decisionProcessResults)
    .values({
      processInstanceId,
      success,
      errorMessage,
      selectedCount: selectedProposalIds.length,
      voterCount,
      pipelineConfig,
    })
    .onConflictDoUpdate({
      target: decisionProcessResults.processInstanceId,
      set: {
        success,
        errorMessage: errorMessage ?? null,
        selectedCount: selectedProposalIds.length,
        voterCount,
        pipelineConfig,
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

  return { resultId };
}

/**
 * Outer-catch fallback: an unexpected error happened (DB read, etc) before
 * the pipeline ran. Stamp the failure on the result row but preserve any
 * existing selections / pipelineConfig / selectedCount — we don't have a new
 * authoritative state to replace them with, so destroying the prior run's
 * data on a transient infra failure would lose information from the user.
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
}): Promise<{ resultId: string }> {
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
  return { resultId: row.id };
}

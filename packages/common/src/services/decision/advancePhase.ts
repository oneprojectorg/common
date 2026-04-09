import { and, desc, eq, inArray, isNull, sql } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  decisionTransitionProposals,
  processInstances,
  proposalHistory,
  stateTransitionHistory,
} from '@op/db/schema';

import { getProposalsForPhase } from './getProposalsForPhase';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';
import { aggregateProposalMetrics, executePipeline } from './selectionPipeline';
import type { ExecutionContext } from './selectionPipeline/types';

export interface AdvancePhaseInput {
  tx: DbClient;
  /** Pre-loaded instance row. Stale snapshots are safe — writes use optimistic locks. */
  instance: {
    id: string;
    instanceData: DecisionInstanceData;
  };
  fromPhaseId: string;
  toPhaseId: string;
  /** Null for cron / system-triggered transitions. */
  triggeredByProfileId: string | null;
  transitionData?: Record<string, unknown>;
  /** Shared timestamp for all writes. Defaults to now. */
  now?: string;
}

export interface AdvancePhaseResult {
  /** True when the optimistic lock failed — another writer already advanced. Nothing was written. */
  conflict: boolean;
  transitionHistoryId?: string;
  survivingProposalIds: string[];
}

/**
 * Atomically advance a decision instance from one phase to the next.
 *
 * Does NOT validate authorization or decide which phase comes next — callers
 * handle those concerns. All writes go through the provided transaction.
 *
 * Steps:
 * 1. Run the departing phase's selection pipeline (if any) to filter proposals.
 * 2. Update currentStateId and instanceData under an optimistic lock
 *    (currentStateId = fromPhaseId AND status = PUBLISHED).
 * 3. Mark any pending scheduled transition for the departing phase complete.
 * 4. Insert a stateTransitionHistory row.
 * 5. Persist surviving proposals into decisionTransitionProposals.
 *
 * Returns { conflict: true } if the lock fails (concurrent advance or status change).
 */
export async function advancePhase(
  input: AdvancePhaseInput,
): Promise<AdvancePhaseResult> {
  const {
    tx,
    instance,
    fromPhaseId,
    toPhaseId,
    triggeredByProfileId,
    transitionData = {},
    now = new Date().toISOString(),
  } = input;

  const instanceId = instance.id;
  const instanceData = instance.instanceData as DecisionInstanceData;

  const departingPhase = instanceData.phases?.find(
    (p: PhaseInstanceData) => p.phaseId === fromPhaseId,
  );
  const selectionPipeline = departingPhase?.selectionPipeline;

  const allProposals = await getProposalsForPhase({
    instanceId,
    dbClient: tx,
  });

  let survivingProposalIds: string[] = allProposals.map((p) => p.id);

  if (selectionPipeline) {
    const proposalMetrics = await aggregateProposalMetrics(allProposals, tx);
    const context: ExecutionContext = {
      proposals: allProposals,
      voteData: proposalMetrics,
      process: {
        instanceId,
        processId: instanceId,
        currentPhaseId: fromPhaseId,
        instanceData,
        processInstance: instance as unknown as Parameters<
          typeof executePipeline
        >[1]['process']['processInstance'],
      },
      variables: {},
      outputs: {},
    };
    const surviving = await executePipeline(selectionPipeline, context);
    survivingProposalIds = surviving.map((p) => p.id);
  }

  // Optimistic lock: only succeeds if currentStateId still matches fromPhaseId.
  const updated = await tx
    .update(processInstances)
    .set({
      currentStateId: toPhaseId,
      updatedAt: now,
      instanceData: sql`jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(${processInstances.instanceData}, '{}'::jsonb),
            '{currentPhaseId}',
            to_jsonb(${toPhaseId}::text)
          ),
          '{stateData}',
          coalesce(${processInstances.instanceData}->'stateData', '{}'::jsonb)
        ),
        array['stateData', ${toPhaseId}]::text[],
        ${JSON.stringify({ enteredAt: now, metadata: transitionData })}::jsonb
      )`,
    })
    .where(
      and(
        eq(processInstances.id, instanceId),
        eq(processInstances.currentStateId, fromPhaseId),
        eq(processInstances.status, ProcessStatus.PUBLISHED),
      ),
    )
    .returning({ id: processInstances.id });

  if (updated.length === 0) {
    return { conflict: true, survivingProposalIds: [] };
  }

  await tx
    .update(decisionProcessTransitions)
    .set({ completedAt: now })
    .where(
      and(
        eq(decisionProcessTransitions.processInstanceId, instanceId),
        eq(decisionProcessTransitions.fromStateId, fromPhaseId),
        isNull(decisionProcessTransitions.completedAt),
      ),
    );

  const [insertedTransition] = await tx
    .insert(stateTransitionHistory)
    .values({
      processInstanceId: instanceId,
      fromStateId: fromPhaseId,
      toStateId: toPhaseId,
      transitionData,
      triggeredByProfileId,
    })
    .returning({ id: stateTransitionHistory.id });

  if (!insertedTransition) {
    throw new Error(
      `stateTransitionHistory insert returned no ID for instance ${instanceId}`,
    );
  }

  if (survivingProposalIds.length > 0) {
    // Get the latest history snapshot for each surviving proposal.
    const latestHistoryRows = await tx
      .selectDistinctOn([proposalHistory.id], {
        proposalId: proposalHistory.id,
        historyId: proposalHistory.historyId,
      })
      .from(proposalHistory)
      .where(
        and(
          eq(proposalHistory.processInstanceId, instanceId),
          inArray(proposalHistory.id, survivingProposalIds),
        ),
      )
      .orderBy(proposalHistory.id, desc(proposalHistory.historyCreatedAt));

    if (latestHistoryRows.length !== survivingProposalIds.length) {
      throw new Error(
        `Proposals missing history records during phase advance for instance ${instanceId}: expected ${survivingProposalIds.length}, got ${latestHistoryRows.length}`,
      );
    }

    await tx.insert(decisionTransitionProposals).values(
      latestHistoryRows.map(({ proposalId, historyId }) => ({
        processInstanceId: instanceId,
        transitionHistoryId: insertedTransition.id,
        proposalId,
        proposalHistoryId: historyId,
      })),
    );
  }

  return {
    conflict: false,
    transitionHistoryId: insertedTransition.id,
    survivingProposalIds,
  };
}

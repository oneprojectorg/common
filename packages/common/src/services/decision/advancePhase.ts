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
  /** Open transaction the caller controls. All writes happen on this tx. */
  tx: DbClient;
  /**
   * Pre-loaded instance row. Caller is responsible for fetching this. The
   * snapshot is used to read instanceData (for the pipeline context and
   * to resolve the departing phase's selection pipeline); all writes go
   * through WHERE-clause optimistic locks, so a stale snapshot here cannot
   * cause split-brain — it can only cause the call to no-op.
   */
  instance: {
    id: string;
    instanceData: DecisionInstanceData;
  };
  /** Phase the instance must currently be on for the advance to apply. */
  fromPhaseId: string;
  /** Phase to advance to. */
  toPhaseId: string;
  /** Profile that triggered this transition. Null for cron / system. */
  triggeredByProfileId: string | null;
  /** Free-form metadata stored on the stateTransitionHistory row. */
  transitionData?: Record<string, unknown>;
  /**
   * Timestamp to use for updatedAt / completedAt / stateData.enteredAt.
   * Caller controls the clock so batched callers (cron) can use a single
   * timestamp across multiple writes if desired.
   */
  now?: string;
}

export interface AdvancePhaseResult {
  /**
   * True when the optimistic lock did not match — another writer already
   * advanced the instance, or status is no longer PUBLISHED. The function
   * has written nothing in this case. Caller decides whether to surface
   * this as an error or skip silently.
   */
  conflict: boolean;
  /** ID of the inserted stateTransitionHistory row. Undefined when conflict. */
  transitionHistoryId?: string;
  /** Proposal IDs that survived the departing phase's selection pipeline. */
  survivingProposalIds: string[];
}

/**
 * Atomically advance a single decision instance from one phase to the next.
 *
 * This function does NOT validate authorization, NOT decide which phase comes
 * next, and NOT invoke processResults. Callers handle those concerns.
 *
 * The selection pipeline is resolved from the instance's own phase data
 * (instanceData.phases), not the process template. The instance is the
 * source of truth — it captures the pipeline that was active at publish time.
 *
 * Behavior (all writes on the provided transaction):
 * 1. Runs the departing phase's selection pipeline (if defined) to compute
 *    the surviving proposal set. Without a pipeline, all phase-visible
 *    proposals survive unchanged.
 * 2. Updates processInstances.currentStateId, instanceData.currentPhaseId,
 *    and instanceData.stateData[toPhaseId].enteredAt under an optimistic
 *    lock requiring (currentStateId = fromPhaseId AND status = PUBLISHED).
 * 3. Marks any pending scheduled transition for the departing phase complete.
 * 4. Inserts a stateTransitionHistory row with the provided transitionData
 *    and triggeredByProfileId.
 * 5. Persists surviving proposals into decisionTransitionProposals, scoped
 *    to the latest proposalHistory snapshot for this instance.
 *
 * Concurrency: if the optimistic lock fails (another writer beat us, or the
 * instance left PUBLISHED), returns { conflict: true } and writes nothing
 * else. Throws on data integrity violations (surviving proposals lacking
 * proposalHistory rows, missing returned transition ID).
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

  // Resolve the selection pipeline from the instance's own phase data,
  // not the process template. The instance captures the pipeline that
  // was active at publish time.
  const departingPhase = instanceData.phases?.find(
    (p: PhaseInstanceData) => p.phaseId === fromPhaseId,
  );
  const selectionPipeline = departingPhase?.selectionPipeline;

  // Default surviving set is all proposals visible in the departing phase.
  // The selection pipeline (if defined) narrows this set.
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

  // Optimistic lock on currentStateId AND status: another concurrent writer
  // can only beat us, never split-brain. The triple jsonb_set ensures
  // stateData[toPhaseId] is written even if stateData was previously absent.
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
    // Scoped by processInstanceId to prevent cross-instance leakage:
    // proposalHistory.id is the original proposal ID (from OLD.id), not unique.
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

import { type DbClient, and, eq, isNull } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
  stateTransitionHistory,
  type Proposal,
} from '@op/db/schema';

import { ConflictError } from '../../utils';
import { attachProposalsToTransition } from './attachProposalsToTransition';
import { getPhaseProposalCosts } from './getPhaseProposalCosts';
import { getProposalsForPhase } from './getProposalsForPhase';
import {
  type DecisionInstanceData,
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';
import type {
  SelectionAudit,
  SelectionOutcomeRecord,
  TransitionData,
} from './schemas/transitionData';
import {
  aggregateProposalMetrics,
  executeSelectionPipeline,
} from './selectionPipeline';
import { getPipelineScores } from './selectionPipeline/getPipelineScores';
import type { ExecutionContext } from './selectionPipeline/types';
import { usesBudgetBlock } from './selectionPipeline/usesBudgetBlock';

export interface AdvancePhaseInput {
  db: DbClient;
  /** Pre-loaded instance row. Stale snapshots are safe — writes use optimistic locks. */
  instance: {
    id: string;
    instanceData: DecisionInstanceData;
  };
  fromPhaseId: string;
  toPhaseId: string;
  /** Null for cron / system-triggered transitions. */
  triggeredByProfileId: string | null;
  transitionData?: TransitionData;
  /** Shared timestamp for all writes. Defaults to now. */
  now?: string;
}

export type AdvancePhaseResult =
  | {
      /** The optimistic lock failed — another writer already advanced. Nothing was written. */
      conflict: true;
    }
  | {
      conflict: false;
      transitionHistoryId: string;
      selectedProposalIds: string[];
    };

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
 * 5. Persist selected proposals into decisionTransitionProposals, unless the
 *    departing phase needs approval; then the admin's manual selection does it.
 *
 * Returns { conflict: true } if the lock fails (concurrent advance or status change).
 */
export async function advancePhase(
  input: AdvancePhaseInput,
): Promise<AdvancePhaseResult> {
  const {
    db,
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

  if (!departingPhase) {
    throw new Error(
      `Phase ${fromPhaseId} not found in instanceData for instance ${instanceId}`,
    );
  }

  // Lock the instance row so a concurrent submitManualSelection can't
  // attach proposals to the inbound transition while we're advancing out.
  const [lockedInstance] = await db
    .select({
      currentStateId: processInstances.currentStateId,
      status: processInstances.status,
      instanceData: processInstances.instanceData,
      processId: processInstances.processId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1)
    .for('update');

  if (
    !lockedInstance ||
    lockedInstance.currentStateId !== fromPhaseId ||
    lockedInstance.status !== ProcessStatus.PUBLISHED
  ) {
    return { conflict: true };
  }

  await assertInboundSelectionApproved({
    db,
    instanceId,
    phaseId: fromPhaseId,
    phases: instanceData.phases,
  });

  // The caller's snapshot may predate a settings or pipeline edit; the locked row is current.
  const lockedDepartingPhase = getInstancePhases(
    lockedInstance.instanceData,
  ).find((phase) => phase.phaseId === fromPhaseId);

  if (!lockedDepartingPhase) {
    return { conflict: true };
  }

  const selectionPipeline = lockedDepartingPhase.selectionPipeline;

  const allProposals = await getProposalsForPhase({
    instanceId,
    db,
  });

  // Default to pass-none; phases opt into pass-all via an empty-blocks pipeline.
  let selectedProposalIds: string[] = [];
  let selection: SelectionAudit | undefined;

  if (selectionPipeline) {
    const [proposalMetrics, proposalCosts] = await Promise.all([
      aggregateProposalMetrics(allProposals, db),
      usesBudgetBlock(selectionPipeline.blocks)
        ? getPhaseProposalCosts({
            instanceData: lockedInstance.instanceData,
            processId: lockedInstance.processId,
            phase: lockedDepartingPhase,
            proposals: allProposals,
          })
        : undefined,
    ]);
    const context: ExecutionContext = {
      proposals: allProposals,
      voteData: proposalMetrics,
      proposalCosts,
      variables: lockedDepartingPhase.settings ?? {},
      outputs: {},
    };
    const selected = await executeSelectionPipeline(selectionPipeline, context);
    selectedProposalIds = selected.map((p) => p.id);
    selection = buildSelectionAudit({
      proposals: allProposals,
      selected,
      skipped: context.skipped ?? [],
    });
  }

  // Optimistic lock: only succeeds if currentStateId still matches fromPhaseId.
  const updated = await db
    .update(processInstances)
    .set({
      currentStateId: toPhaseId,
      updatedAt: now,
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
    return { conflict: true };
  }

  await db
    .update(decisionProcessTransitions)
    .set({ completedAt: now })
    .where(
      and(
        eq(decisionProcessTransitions.processInstanceId, instanceId),
        eq(decisionProcessTransitions.fromStateId, fromPhaseId),
        isNull(decisionProcessTransitions.completedAt),
      ),
    );

  const [insertedTransition] = await db
    .insert(stateTransitionHistory)
    .values({
      processInstanceId: instanceId,
      fromStateId: fromPhaseId,
      toStateId: toPhaseId,
      transitionData: selection
        ? { ...transitionData, selection }
        : transitionData,
      triggeredByProfileId,
    })
    .returning({ id: stateTransitionHistory.id });

  if (!insertedTransition) {
    throw new Error(
      `stateTransitionHistory insert returned no ID for instance ${instanceId}`,
    );
  }

  // Awaiting approval: nothing is attached, so the manual selection screen
  // shows and the admin's confirmation attaches the proposals.
  if (lockedDepartingPhase.selectionNeedsApproval) {
    selectedProposalIds = [];
  }

  await attachProposalsToTransition({
    dbClient: db,
    processInstanceId: instanceId,
    transitionHistoryId: insertedTransition.id,
    proposalIds: selectedProposalIds,
  });

  return {
    conflict: false,
    transitionHistoryId: insertedTransition.id,
    selectedProposalIds,
  };
}

/** One outcome per proposal the pipeline saw, with the values blocks wrote on its copy. */
function buildSelectionAudit({
  proposals,
  selected,
  skipped,
}: {
  proposals: Proposal[];
  selected: Proposal[];
  skipped: Proposal[];
}): SelectionAudit {
  const selectedById = new Map(
    selected.map((proposal) => [proposal.id, proposal]),
  );
  const skippedById = new Map(
    skipped.map((proposal) => [proposal.id, proposal]),
  );

  const outcomeOf = (proposal: Proposal): SelectionOutcomeRecord => {
    const selectedCopy = selectedById.get(proposal.id);
    if (selectedCopy) {
      return {
        proposalId: proposal.id,
        outcome: 'selected',
        scores: getPipelineScores(selectedCopy),
      };
    }

    const skippedCopy = skippedById.get(proposal.id);
    if (skippedCopy) {
      return {
        proposalId: proposal.id,
        outcome: 'skipped',
        scores: getPipelineScores(skippedCopy),
      };
    }

    return { proposalId: proposal.id, outcome: 'excluded', scores: {} };
  };

  const rest = proposals.filter((proposal) => !selectedById.has(proposal.id));

  return { outcomes: [...selected, ...rest].map(outcomeOf) };
}

/**
 * A phase whose inbound selection still awaits an admin's approval cannot
 * advance: a scheduled transition would otherwise move on with no proposals
 * and leave the held selection with nothing to confirm into.
 */
async function assertInboundSelectionApproved({
  db,
  instanceId,
  phaseId,
  phases,
}: {
  db: DbClient;
  instanceId: string;
  phaseId: string;
  phases: readonly PhaseInstanceData[];
}): Promise<void> {
  const inbound = await db.query.stateTransitionHistory.findFirst({
    where: { processInstanceId: instanceId, toStateId: phaseId },
    orderBy: { transitionedAt: 'desc' },
    columns: { fromStateId: true, transitionData: true },
  });

  if (!inbound) {
    return;
  }

  const previousPhase = phases.find(
    (phase) => phase.phaseId === inbound.fromStateId,
  );

  if (!previousPhase?.selectionNeedsApproval) {
    return;
  }

  if (!isApprovedTransition(inbound.transitionData)) {
    throw new ConflictError(
      'The selection into this phase awaits approval. Confirm it before advancing.',
    );
  }
}

function isApprovedTransition(transitionData: unknown): boolean {
  return (
    transitionData !== null &&
    typeof transitionData === 'object' &&
    'manualSelection' in transitionData
  );
}

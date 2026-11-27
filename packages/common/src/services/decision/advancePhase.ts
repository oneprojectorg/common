import { type DbClient, and, eq, isNull } from '@op/db/client';
import {
  ProcessStatus,
  decisionProcessTransitions,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';

import { ConflictError } from '../../utils';
import { attachProposalsToTransition } from './attachProposalsToTransition';
import { getProposalsForPhase } from './getProposalsForPhase';
import type { InstanceWithPhases } from './instancePhases';
import type { TransitionData } from './schemas/transitionData';
import {
  aggregateProposalMetrics,
  executeSelectionPipeline,
} from './selectionPipeline';
import type { ExecutionContext } from './selectionPipeline/types';
import { needsSelectionApproval } from './utils/phaseSettings';

export interface AdvancePhaseInput {
  db: DbClient;
  /** Pre-loaded instance row. State writes use optimistic locks; the departing phase config comes from `phases`. */
  instance: InstanceWithPhases<{ id: string }>;
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
      /** The phase the locked row was on; null when the row was gone or not published. */
      currentStateId: string | null;
    }
  | {
      conflict: false;
      transitionHistoryId: string;
      selectedProposalIds: string[];
      /** The attached proposals stay out of the phase until an admin confirms them. */
      selectionAwaitingApproval: boolean;
    };

/**
 * Atomically advance a decision instance from one phase to the next.
 *
 * Does NOT validate authorization or decide which phase comes next — callers
 * handle those concerns. All writes go through the provided transaction.
 *
 * Steps:
 * 1. Run the departing phase's selection pipeline (if any) to filter proposals.
 * 2. Update currentStateId under an optimistic lock
 *    (currentStateId = fromPhaseId AND status = PUBLISHED).
 * 3. Mark any pending scheduled transition for the departing phase complete.
 * 4. Insert a stateTransitionHistory row, held for approval when the
 *    departing phase's advancement rule says so.
 * 5. Persist selected proposals into decisionTransitionProposals.
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
  const { phases } = instance;

  const departingPhase = phases.find((p) => p.phaseId === fromPhaseId);
  if (!departingPhase) {
    throw new Error(
      `Phase ${fromPhaseId} not found in phases for instance ${instanceId}`,
    );
  }

  // Lock the instance row so a concurrent submitManualSelection can't
  // attach proposals to the inbound transition while we're advancing out.
  const [lockedInstance] = await db
    .select({
      currentStateId: processInstances.currentStateId,
      status: processInstances.status,
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
    return {
      conflict: true,
      currentStateId:
        lockedInstance?.status === ProcessStatus.PUBLISHED
          ? lockedInstance.currentStateId
          : null,
    };
  }

  await assertInboundSelectionApproved({
    db,
    instanceId,
    phaseId: fromPhaseId,
  });

  const selectionPipeline = departingPhase.selectionPipeline;

  const allProposals = await getProposalsForPhase({
    instanceId,
    db,
  });

  // Default to pass-none; phases opt into pass-all via an empty-blocks pipeline.
  let selectedProposalIds: string[] = [];

  if (selectionPipeline) {
    const proposalMetrics = await aggregateProposalMetrics(allProposals, db);
    const context: ExecutionContext = {
      proposals: allProposals,
      voteData: proposalMetrics,
      variables: {},
      outputs: {},
    };
    const selected = await executeSelectionPipeline(selectionPipeline, context);
    selectedProposalIds = selected.map((p) => p.id);
  }

  // An empty selection has nothing to approve; holding it would block the phase
  // until a confirmation that cannot be submitted.
  const selectionAwaitingApproval =
    selectionPipeline !== undefined &&
    selectedProposalIds.length > 0 &&
    needsSelectionApproval(departingPhase);
  // A selection that needs no approval is settled as it is made, empty or not;
  // any other waits for an admin.
  const selectionConfirmedAt =
    selectionPipeline !== undefined && !needsSelectionApproval(departingPhase)
      ? new Date(now)
      : null;

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
    return { conflict: true, currentStateId: null };
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
      transitionData,
      triggeredByProfileId,
      selectionConfirmedAt,
    })
    .returning({ id: stateTransitionHistory.id });

  if (!insertedTransition) {
    throw new Error(
      `stateTransitionHistory insert returned no ID for instance ${instanceId}`,
    );
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
    selectionAwaitingApproval,
  };
}

/**
 * A held selection blocks the next advance: a scheduled transition would
 * otherwise move on while the phase's attachments are still unconfirmed.
 */
async function assertInboundSelectionApproved({
  db,
  instanceId,
  phaseId,
}: {
  db: DbClient;
  instanceId: string;
  phaseId: string;
}): Promise<void> {
  const inbound = await db.query.stateTransitionHistory.findFirst({
    where: { processInstanceId: instanceId, toStateId: phaseId },
    orderBy: { transitionedAt: 'desc' },
    columns: { selectionConfirmedAt: true },
    with: {
      transitionProposals: { columns: { proposalId: true }, limit: 1 },
    },
  });

  // Held: picks attached but not confirmed. A transition waiting for a manual
  // selection has nothing attached and does not block.
  if (
    inbound?.selectionConfirmedAt === null &&
    inbound.transitionProposals.length > 0
  ) {
    throw new SelectionAwaitingApprovalError();
  }
}

/** The phase's inbound selection is held, so it cannot be left yet. */
export class SelectionAwaitingApprovalError extends ConflictError {
  constructor() {
    super(
      'The selection into this phase awaits approval. Confirm it before advancing.',
    );
  }
}

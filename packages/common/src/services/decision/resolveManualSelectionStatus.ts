import { db, desc, eq } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import {
  decisionTransitionProposals,
  stateTransitionHistory,
} from '@op/db/schema';

import { isLegacyInstanceData } from './isLegacyInstance';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { TransitionData } from './schemas/transitionData';

export type InstanceForStatusResolution = {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
};

export type ManualSelectionStatus =
  | { selectionsConfirmed: true }
  | { selectionsConfirmed: false; previousPhaseId: string };

/**
 * Is the current phase's inbound transition still awaiting a manual selection?
 *
 * `selectionsConfirmed: false` means the UI should prompt an admin to pick
 * proposals — the transition exists but has zero attachments and no
 * `manualSelection` stamp. Any other shape (legacy instance, initial phase,
 * already-stamped, already-attached) resolves to `true`.
 */
export async function resolveManualSelectionStatus({
  instance,
  dbClient = db,
}: {
  instance: InstanceForStatusResolution;
  dbClient?: DbClient;
}): Promise<ManualSelectionStatus> {
  if (isLegacyInstanceData(instance.instanceData)) {
    return { selectionsConfirmed: true };
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    return { selectionsConfirmed: true };
  }

  const instanceData = instance.instanceData as DecisionInstanceData | null;
  const phases = instanceData?.phases;
  if (!phases || phases.length === 0) {
    return { selectionsConfirmed: true };
  }

  const currentPhaseIndex = phases.findIndex(
    (p) => p.phaseId === currentStateId,
  );
  if (currentPhaseIndex <= 0) {
    return { selectionsConfirmed: true };
  }

  const previousPhase = phases[currentPhaseIndex - 1];
  if (!previousPhase) {
    return { selectionsConfirmed: true };
  }

  const [latestRow] = await dbClient
    .select({
      id: stateTransitionHistory.id,
      toStateId: stateTransitionHistory.toStateId,
      transitionData: stateTransitionHistory.transitionData,
    })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, instance.id))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  if (!latestRow || latestRow.toStateId !== currentStateId) {
    return { selectionsConfirmed: true };
  }

  const hasManualSelectionStamp = Boolean(
    (latestRow.transitionData as TransitionData | null | undefined)
      ?.manualSelection,
  );

  if (hasManualSelectionStamp) {
    return { selectionsConfirmed: true };
  }

  const [attached] = await dbClient
    .select({ id: decisionTransitionProposals.transitionHistoryId })
    .from(decisionTransitionProposals)
    .where(eq(decisionTransitionProposals.transitionHistoryId, latestRow.id))
    .limit(1);

  if (attached) {
    return { selectionsConfirmed: true };
  }

  return { selectionsConfirmed: false, previousPhaseId: previousPhase.phaseId };
}

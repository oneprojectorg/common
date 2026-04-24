import { db } from '@op/db/client';
import type { DbClient } from '@op/db/client';

import { isLegacyInstanceData } from './isLegacyInstance';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { TransitionData } from './schemas/transitionData';

export type InstanceForStatusResolution = {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
};

export type ManualSelectionStatus =
  | { selectionsAreConfirmed: true }
  | { selectionsAreConfirmed: false; previousPhaseId: string };

/**
 * Is the current phase's inbound transition still awaiting a manual selection?
 *
 * `selectionsAreConfirmed: false` means the UI should prompt an admin to pick
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
    return { selectionsAreConfirmed: true };
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    return { selectionsAreConfirmed: true };
  }

  const instanceData = instance.instanceData as DecisionInstanceData | null;
  const phases = instanceData?.phases;
  if (!phases || phases.length === 0) {
    return { selectionsAreConfirmed: true };
  }

  const currentPhaseIndex = phases.findIndex(
    (p) => p.phaseId === currentStateId,
  );
  if (currentPhaseIndex <= 0) {
    return { selectionsAreConfirmed: true };
  }

  const previousPhase = phases[currentPhaseIndex - 1];
  if (!previousPhase) {
    return { selectionsAreConfirmed: true };
  }

  const latestRow = await dbClient.query.stateTransitionHistory.findFirst({
    where: { processInstanceId: instance.id },
    orderBy: { transitionedAt: 'desc' },
    columns: { id: true, toStateId: true, transitionData: true },
  });

  if (!latestRow || latestRow.toStateId !== currentStateId) {
    return { selectionsAreConfirmed: true };
  }

  const hasManualSelectionStamp = Boolean(
    (latestRow.transitionData as TransitionData | null | undefined)
      ?.manualSelection,
  );

  if (hasManualSelectionStamp) {
    return { selectionsAreConfirmed: true };
  }

  const attached = await dbClient.query.decisionTransitionProposals.findFirst({
    where: { transitionHistoryId: latestRow.id },
    columns: { transitionHistoryId: true },
  });

  if (attached) {
    return { selectionsAreConfirmed: true };
  }

  return { selectionsAreConfirmed: false, previousPhaseId: previousPhase.phaseId };
}

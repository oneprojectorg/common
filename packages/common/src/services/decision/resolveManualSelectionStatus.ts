import { db } from '@op/db/client';
import type { DbClient } from '@op/db/client';

import { isLegacyInstanceData } from './isLegacyInstance';

export type InstanceForStatusResolution = {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
  phases: readonly { phaseId: string }[];
};

export type ManualSelectionStatus =
  | { selectionsAreConfirmed: true }
  | { selectionsAreConfirmed: false; previousPhaseId: string };

/**
 * Is the current phase's inbound transition still awaiting a manual selection?
 *
 * `selectionsAreConfirmed: false` means the UI should prompt an admin to pick
 * proposals — the inbound transition has no `selectionConfirmedAt`. Any other
 * shape (legacy instance, initial phase, confirmed selection) resolves to
 * `true`.
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

  const { phases } = instance;
  if (phases.length === 0) {
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
    columns: { toStateId: true, selectionConfirmedAt: true },
  });

  if (!latestRow || latestRow.toStateId !== currentStateId) {
    return { selectionsAreConfirmed: true };
  }

  if (latestRow.selectionConfirmedAt !== null) {
    return { selectionsAreConfirmed: true };
  }

  return {
    selectionsAreConfirmed: false,
    previousPhaseId: previousPhase.phaseId,
  };
}

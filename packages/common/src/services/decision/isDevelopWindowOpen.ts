import { db } from '@op/db/client';
import type { DbClient } from '@op/db/client';

import {
  type InstanceForStatusResolution,
  resolveManualSelectionStatus,
} from './resolveManualSelectionStatus';
import type { PhaseRules } from './schemas/types';
import { isDevelopPhase } from './utils/phaseSettings';

type DevelopWindowInstance = Omit<InstanceForStatusResolution, 'phases'> & {
  phases: readonly { phaseId: string; rules?: PhaseRules }[];
};

/**
 * The develop window is open while the current phase is a develop phase and
 * its selections are not confirmed — the pair that shows the develop screens.
 * Checks the phase first, so other phases cost no query.
 */
export async function isDevelopWindowOpen({
  instance,
  dbClient = db,
}: {
  instance: DevelopWindowInstance;
  dbClient?: DbClient;
}): Promise<boolean> {
  const currentPhase = instance.phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  if (!currentPhase || !isDevelopPhase(currentPhase)) {
    return false;
  }

  const { selectionsAreConfirmed } = await resolveManualSelectionStatus({
    instance,
    dbClient,
  });

  return !selectionsAreConfirmed;
}

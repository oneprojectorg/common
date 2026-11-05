import { db } from '@op/db/client';

import {
  type PhaseInstanceData,
  assertInstancePhase,
  invalidateDecisionInstance,
} from '../../src/services/decision';
import {
  listPhases,
  reconcilePhases,
  toInstanceDataPhase,
} from '../../src/services/decision/phaseHelpers';

export const loadPhaseRows = (processInstanceId: string) =>
  listPhases({ db, processInstanceId });

/** Rewrites the decision's phase rows to what `update` returns, as a builder save does. */
export const updateInstancePhases = async ({
  instanceId,
  update,
}: {
  instanceId: string;
  update: (phases: PhaseInstanceData[]) => PhaseInstanceData[];
}): Promise<void> => {
  await db.transaction(async (tx) => {
    const existing = await listPhases({
      db: tx,
      processInstanceId: instanceId,
    });
    await reconcilePhases({
      tx,
      processInstanceId: instanceId,
      existing,
      phases: update(existing.map(toInstanceDataPhase)),
    });
  });
  await invalidateDecisionInstance(instanceId);
};

/** {@link updateInstancePhases} for one phase; an unknown phase throws `NotFoundError`. */
export const updateInstancePhase = ({
  instanceId,
  phaseId,
  update,
}: {
  instanceId: string;
  phaseId: string;
  update: (phase: PhaseInstanceData) => PhaseInstanceData;
}): Promise<void> =>
  updateInstancePhases({
    instanceId,
    update: (phases) => {
      assertInstancePhase({ instance: { instanceData: { phases } }, phaseId });
      return phases.map((phase) =>
        phase.phaseId === phaseId ? update(phase) : phase,
      );
    },
  });

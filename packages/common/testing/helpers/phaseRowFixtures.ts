import { db } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { eq, inArray, or } from 'drizzle-orm';

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

// An instance's phase profiles outlive it unless deleted with it.
export const deleteProfilesWithPhaseProfiles = (profileIds: string[]) =>
  db
    .delete(profiles)
    .where(
      or(
        inArray(profiles.id, profileIds),
        inArray(
          profiles.id,
          db
            .select({ id: processPhases.profileId })
            .from(processPhases)
            .innerJoin(
              processInstances,
              eq(processInstances.id, processPhases.processInstanceId),
            )
            .where(inArray(processInstances.profileId, profileIds)),
        ),
      ),
    );

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

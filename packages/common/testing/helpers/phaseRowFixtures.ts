import { db } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { eq, sql } from 'drizzle-orm';

import {
  type PhaseInstanceData,
  assertInstancePhase,
  invalidateDecisionInstance,
} from '../../src/services/decision';
import {
  reconcilePhases,
  toPhaseInstanceData,
} from '../../src/services/decision/phaseHelpers';
import { mutatePhases } from '../../src/services/decision/phaseMirror';

/** Empties `instanceData.phases`, leaving the rows as the only record of them. */
export const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));

export const leaveOnlyPhaseRows = async (
  instanceId: string,
  rowData: Record<string, unknown> = {},
): Promise<void> => {
  await db
    .update(processPhases)
    .set({
      data: sql`${processPhases.data} || ${JSON.stringify(rowData)}::jsonb`,
    })
    .where(eq(processPhases.processInstanceId, instanceId));
  await db
    .update(profiles)
    .set({ name: sql`'Row ' || (${processPhases.data} ->> 'phaseId')` })
    .from(processPhases)
    .where(
      sql`${profiles.id} = ${processPhases.profileId} AND ${processPhases.processInstanceId} = ${instanceId}`,
    );
  await emptyBlobPhases(instanceId);
};

/**
 * Rewrites the decision's phase rows to what `update` returns and mirrors them
 * onto `instanceData.phases`, as `updateDecisionInstance` does.
 */
export const updateInstancePhases = async ({
  instanceId,
  update,
}: {
  instanceId: string;
  update: (phases: PhaseInstanceData[]) => PhaseInstanceData[];
}): Promise<void> => {
  await db.transaction((tx) =>
    mutatePhases({
      db: tx,
      processInstanceId: instanceId,
      mutate: ({ phases: existing }) =>
        reconcilePhases({
          db: tx,
          processInstanceId: instanceId,
          existing,
          phases: update(existing.map(toPhaseInstanceData)),
        }),
    }),
  );
  await invalidateDecisionInstance(instanceId);
};

/**
 * {@link updateInstancePhases} for one phase. An unknown phase throws
 * `NotFoundError`, as production reads do.
 */
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

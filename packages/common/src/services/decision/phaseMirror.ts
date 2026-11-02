import { type DbClient, eq, sql } from '@op/db/client';
import { processInstances } from '@op/db/schema';

import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { type DecisionPhase, listPhases, phaseIdOf } from './phaseHelpers';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

// Everything here reads or writes `instance_data.phases`; the file goes with
// the blob.

/**
 * The phases a decision holds: the minted ones, plus each `instance_data`
 * phase that has none yet (the phase endpoints can mint before the backfill).
 */
export const mergePhasesWithInstanceData = ({
  phases,
  blobPhases,
}: {
  phases: DecisionPhase[];
  blobPhases: readonly PhaseInstanceData[];
}): PhaseInstanceData[] => {
  const mintedPhaseIds = new Set(phases.map(phaseIdOf));
  // A blob phase has no sortOrder; its index stands in, and a minted phase
  // wins a tie.
  const placed = [
    ...phases.map((phase) => ({
      position: phase.sortOrder,
      rank: 0,
      phase: toInstanceDataPhase(phase),
    })),
    ...blobPhases.flatMap((phase, position) =>
      mintedPhaseIds.has(phase.phaseId) ? [] : [{ position, rank: 1, phase }],
    ),
  ];

  return placed
    .sort((a, b) => a.position - b.position || a.rank - b.rank)
    .map(({ phase }) => phase);
};

/**
 * Locks the decision, hands its phases to `mutate`, then mirrors them onto
 * `instance_data.phases` so the builder's next save lists them. The mirror
 * places the blob phases by their index in the whole blob, and drops a phase
 * `mutate` deleted so it does not come back through the blob.
 */
export const mutatePhases = async <T>({
  db,
  processInstanceId,
  mutate,
}: {
  db: DbClient;
  processInstanceId: string;
  mutate: (stored: {
    phases: DecisionPhase[];
    unmintedPhases: PhaseInstanceData[];
  }) => Promise<T>;
}): Promise<{ result: T; phases: DecisionPhase[] }> => {
  const locked = await lockProcessInstanceOrThrow({
    db,
    instanceId: processInstanceId,
  });
  const phases = await listPhases({ db, processInstanceId });
  const mintedPhaseIds = new Set(phases.map(phaseIdOf));
  const blobPhases = getInstancePhases(locked.instanceData);
  const unmintedPhases = blobPhases.filter(
    ({ phaseId }) => !mintedPhaseIds.has(phaseId),
  );

  const result = await mutate({ phases, unmintedPhases });

  const written = await listPhases({ db, processInstanceId });
  const writtenPhaseIds = new Set(written.map(phaseIdOf));
  const mirrored = mergePhasesWithInstanceData({
    phases: written,
    blobPhases: blobPhases.filter(
      ({ phaseId }) =>
        writtenPhaseIds.has(phaseId) || !mintedPhaseIds.has(phaseId),
    ),
  });
  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(mirrored)}::jsonb)`,
    })
    .where(eq(processInstances.id, processInstanceId));

  return { result, phases: written };
};

const toInstanceDataPhase = (phase: DecisionPhase): PhaseInstanceData => ({
  ...phase.data,
  phaseId: phaseIdOf(phase),
  name: phase.name,
});

import { type DbClient, eq, sql } from '@op/db/client';
import { ProcessStatus, processInstances } from '@op/db/schema';

import { CommonError } from '../../utils';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { type DecisionPhase, listPhases, phaseIdOf } from './phaseHelpers';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

// TODO: delete this file when instance_data.phases is dropped.

export const mergePhasesWithInstanceData = ({
  phases,
  blobPhases,
}: {
  phases: DecisionPhase[];
  blobPhases: readonly PhaseInstanceData[];
}): PhaseInstanceData[] => {
  const mintedPhaseIds = new Set(phases.map(phaseIdOf));
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
  const [updated] = await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(mirrored)}::jsonb)`,
    })
    .where(eq(processInstances.id, processInstanceId))
    .returning();

  if (!updated) {
    throw new CommonError('Failed to update decision process instance');
  }

  // Drafts hold no transitions; a save deletes them.
  if (updated.status !== ProcessStatus.DRAFT) {
    await updateTransitionsForProcess({ processInstance: updated, db });
  }

  return { result, phases: written };
};

const toInstanceDataPhase = (phase: DecisionPhase): PhaseInstanceData => ({
  ...phase.data,
  phaseId: phaseIdOf(phase),
  name: phase.name,
});

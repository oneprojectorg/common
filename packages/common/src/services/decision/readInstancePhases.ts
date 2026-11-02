import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import {
  type DecisionPhase,
  listPhasesByInstance,
  phaseIdOf,
  toPhaseInstanceData,
} from './phaseHelpers';
import type { PhaseInstanceData } from './schemas/instanceData';

interface InstanceWithData {
  id: string;
  instanceData: unknown;
}

/**
 * Each decision's phases in order, read from `decision_process_phases`. A
 * decision with no rows maps to `[]`.
 */
export const listInstancePhases = async ({
  db,
  processInstanceIds,
}: {
  db: DbClient;
  processInstanceIds: string[];
}): Promise<Map<string, PhaseInstanceData[]>> => {
  const phasesByInstance = new Map<string, PhaseInstanceData[]>();

  if (processInstanceIds.length === 0) {
    return phasesByInstance;
  }

  const rowsByInstance = await listPhasesByInstance({ db, processInstanceIds });
  const withoutRows: string[] = [];

  for (const processInstanceId of new Set(processInstanceIds)) {
    const rows = rowsByInstance.get(processInstanceId);
    if (!rows) {
      withoutRows.push(processInstanceId);
    }
    phasesByInstance.set(
      processInstanceId,
      dropDuplicatePhases({ processInstanceId, rows: rows ?? [] }),
    );
  }

  if (withoutRows.length > 0) {
    logger.warn('Decision has no phase rows', {
      processInstanceIds: withoutRows,
    });
  }

  return phasesByInstance;
};

/** The decision's phases in order. Inside a transaction, pass its `tx`. */
export const readInstancePhases = async ({
  db,
  processInstanceId,
}: {
  db: DbClient;
  processInstanceId: string;
}): Promise<PhaseInstanceData[]> =>
  (
    await listInstancePhases({ db, processInstanceIds: [processInstanceId] })
  ).get(processInstanceId) ?? [];

/**
 * The instance with `instanceData.phases` replaced by its rows, for the
 * encoders that emit the blob shape.
 */
export const withInstancePhases = async <T extends InstanceWithData>({
  instance,
  db = defaultDb,
}: {
  instance: T;
  db?: DbClient;
}): Promise<T> => {
  const [resolved] = await withInstancesPhases({ instances: [instance], db });
  return resolved ?? instance;
};

/** {@link withInstancePhases} for a list, in one rows query. */
export const withInstancesPhases = async <T extends InstanceWithData>({
  instances,
  db = defaultDb,
}: {
  instances: T[];
  db?: DbClient;
}): Promise<T[]> => {
  const phasesByInstance = await listInstancePhases({
    db,
    processInstanceIds: instances.map(({ id }) => id),
  });

  return instances.map((instance) => ({
    ...instance,
    instanceData: {
      ...asRecord(instance.instanceData),
      phases: phasesByInstance.get(instance.id) ?? [],
    },
  }));
};

export const withProfileInstancePhases = async <
  T extends { processInstance: InstanceWithData | null },
>({
  profile,
  db = defaultDb,
}: {
  profile: T;
  db?: DbClient;
}): Promise<T> => {
  if (!profile.processInstance) {
    return profile;
  }

  return {
    ...profile,
    processInstance: await withInstancePhases({
      instance: profile.processInstance,
      db,
    }),
  };
};

// No unique index guards a phase id. The rows arrive in sort order, so the
// first row for an id has the lowest sortOrder.
export const dropDuplicatePhases = ({
  processInstanceId,
  rows,
}: {
  processInstanceId: string;
  rows: DecisionPhase[];
}): PhaseInstanceData[] => {
  const phaseIds = new Set<string>();
  const duplicatePhaseIds = new Set<string>();
  const phases: PhaseInstanceData[] = [];

  for (const row of rows) {
    const phaseId = phaseIdOf(row);
    if (phaseIds.has(phaseId)) {
      duplicatePhaseIds.add(phaseId);
      continue;
    }
    phaseIds.add(phaseId);
    phases.push(toPhaseInstanceData(row));
  }

  if (duplicatePhaseIds.size > 0) {
    logger.warn('Decision has two phase rows with one phase id', {
      processInstanceId,
      phaseIds: [...duplicatePhaseIds],
    });
  }

  return phases;
};

const asRecord = (value: unknown): object =>
  typeof value === 'object' && value !== null ? value : {};

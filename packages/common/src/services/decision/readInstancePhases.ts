import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { isServerFeatureEnabled } from '../../utils/featureFlags';
import {
  getStoredPhases,
  loadPhaseRows,
  loadPhaseRowsByInstance,
} from './phaseRows';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

export const PHASES_FROM_ROWS_FLAG = 'process_phases_from_rows';

interface InstanceWithData {
  id: string;
  instanceData: unknown;
}

const NO_ROWS_WARNING =
  'Decision has no phase rows; reading instanceData.phases';

/**
 * Whether phases are read from `decision_process_phases`. One switch for the
 * whole server, so a percentage rollout is all or nothing. Resolve it before
 * taking an instance lock: an uncached answer waits on PostHog.
 */
export const isPhasesFromRowsEnabled = (): Promise<boolean> =>
  isServerFeatureEnabled({
    key: PHASES_FROM_ROWS_FLAG,
    distinctId: PHASES_FROM_ROWS_FLAG,
  });

/**
 * The decision's phases in order: its rows plus any `instanceData.phases` entry
 * without one while {@link PHASES_FROM_ROWS_FLAG} is on, else
 * `instanceData.phases`. Pass `fromRows` when the flag is already resolved.
 */
export const readInstancePhases = async ({
  instance,
  db = defaultDb,
  fromRows,
}: {
  instance: InstanceWithData;
  db?: DbClient;
  fromRows?: boolean;
}): Promise<PhaseInstanceData[]> =>
  (await readRowPhases({ instance, db, fromRows })) ?? getBlobPhases(instance);

/**
 * The instance with `instanceData.phases` replaced by {@link readInstancePhases},
 * for the synchronous readers and encoders that take the blob.
 */
export const withInstancePhases = async <T extends InstanceWithData>({
  instance,
  db = defaultDb,
  fromRows,
}: {
  instance: T;
  db?: DbClient;
  fromRows?: boolean;
}): Promise<T> =>
  replacePhases({
    instance,
    phases: await readRowPhases({ instance, db, fromRows }),
  });

/** {@link withInstancePhases} for a list: one flag check, one rows query. */
export const withInstancesPhases = async <T extends InstanceWithData>({
  instances,
  db = defaultDb,
  fromRows,
}: {
  instances: T[];
  db?: DbClient;
  fromRows?: boolean;
}): Promise<T[]> => {
  if (instances.length === 0) {
    return instances;
  }

  if (!(fromRows ?? (await isPhasesFromRowsEnabled()))) {
    return instances;
  }

  const rowsByInstance = await loadPhaseRowsByInstance({
    db,
    processInstanceIds: instances.map(({ id }) => id),
  });

  const withoutRows = instances
    .filter(({ id }) => !rowsByInstance.has(id))
    .map(({ id }) => id);
  if (withoutRows.length > 0) {
    logger.warn(NO_ROWS_WARNING, { processInstanceIds: withoutRows });
  }

  return instances.map((instance) => {
    const rows = rowsByInstance.get(instance.id);

    return replacePhases({
      instance,
      phases: rows
        ? getStoredPhases({ rows, blobPhases: getBlobPhases(instance) })
        : null,
    });
  });
};

/** {@link withInstancePhases} on a decision profile's joined instance. */
export const withProfileInstancePhases = async <
  T extends { processInstance: InstanceWithData | null },
>({
  profile,
}: {
  profile: T;
}): Promise<T> => {
  if (!profile.processInstance) {
    return profile;
  }

  return {
    ...profile,
    processInstance: await withInstancePhases({
      instance: profile.processInstance,
    }),
  };
};

const readRowPhases = async ({
  instance,
  db,
  fromRows,
}: {
  instance: InstanceWithData;
  db: DbClient;
  fromRows?: boolean;
}): Promise<PhaseInstanceData[] | null> => {
  if (!(fromRows ?? (await isPhasesFromRowsEnabled()))) {
    return null;
  }

  const rows = await loadPhaseRows({ db, processInstanceId: instance.id });

  if (rows.length === 0) {
    logger.warn(NO_ROWS_WARNING, { processInstanceIds: [instance.id] });
    return null;
  }

  return getStoredPhases({ rows, blobPhases: getBlobPhases(instance) });
};

const getBlobPhases = (instance: InstanceWithData): PhaseInstanceData[] => [
  ...getInstancePhases(instance.instanceData),
];

const replacePhases = <T extends InstanceWithData>({
  instance,
  phases,
}: {
  instance: T;
  phases: PhaseInstanceData[] | null;
}): T =>
  phases
    ? {
        ...instance,
        instanceData: { ...asRecord(instance.instanceData), phases },
      }
    : instance;

const asRecord = (value: unknown): object =>
  typeof value === 'object' && value !== null ? value : {};

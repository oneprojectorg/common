import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { isServerFeatureEnabled } from '../../utils/featureFlags';
import { loadPhaseRows, projectPhaseRows } from './phaseRows';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

export const PHASES_FROM_ROWS_FLAG = 'process_phases_from_rows';

interface InstanceWithData {
  id: string;
  instanceData: unknown;
}

/**
 * The decision's phases in order: from its `decision_process_phases` rows
 * when {@link PHASES_FROM_ROWS_FLAG} is on for the instance, else from
 * `instanceData.phases`.
 */
export const readInstancePhases = async ({
  instance,
  db = defaultDb,
}: {
  instance: InstanceWithData;
  db?: DbClient;
}): Promise<PhaseInstanceData[]> =>
  (await readRowPhases({ instance, db })) ?? [
    ...getInstancePhases(instance.instanceData),
  ];

/**
 * The instance with `instanceData.phases` replaced by {@link readInstancePhases},
 * for the synchronous readers and encoders that take the blob.
 */
export const withInstancePhases = async <T extends InstanceWithData>({
  instance,
  db = defaultDb,
}: {
  instance: T;
  db?: DbClient;
}): Promise<T> => {
  const phases = await readRowPhases({ instance, db });

  if (!phases) {
    return instance;
  }

  return {
    ...instance,
    instanceData: { ...asRecord(instance.instanceData), phases },
  };
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
}: {
  instance: InstanceWithData;
  db: DbClient;
}): Promise<PhaseInstanceData[] | null> => {
  const enabled = await isServerFeatureEnabled({
    key: PHASES_FROM_ROWS_FLAG,
    distinctId: instance.id,
  });

  if (!enabled) {
    return null;
  }

  const rows = await loadPhaseRows({ db, processInstanceId: instance.id });

  if (rows.length === 0) {
    logger.warn('Decision has no phase rows; reading instanceData.phases', {
      processInstanceId: instance.id,
    });
    return null;
  }

  return projectPhaseRows(rows);
};

const asRecord = (value: unknown): object =>
  typeof value === 'object' && value !== null ? value : {};

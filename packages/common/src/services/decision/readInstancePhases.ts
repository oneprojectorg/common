import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { isServerFeatureEnabled } from '../../utils/featureFlags';
import { listPhasesByInstance } from './phaseHelpers';
import { mergePhasesWithInstanceData } from './phaseMirror';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

export const PHASES_FROM_ROWS_FLAG = 'process_phases_from_rows';

interface InstanceWithData {
  id: string;
  instanceData: unknown;
}

const resolvedPhases = Symbol('resolvedPhases');

/** An instance whose `instanceData.phases` holds its resolved phases. */
export type PhasesResolved<T> = T & { readonly [resolvedPhases]: true };

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
  getBlobPhases(await withInstancePhases({ instance, db, fromRows }));

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
}): Promise<PhasesResolved<T>> => {
  const [resolved] = await withInstancesPhases({
    instances: [instance],
    db,
    fromRows,
  });
  return resolved ?? markResolved(instance);
};

/**
 * The instance as resolved, for a blob that already holds its phases: rebuilt
 * from the rows by a save, or resolved in an earlier workflow step.
 */
export const withBlobPhases = <T extends InstanceWithData>({
  instance,
}: {
  instance: T;
}): PhasesResolved<T> => markResolved(instance);

export const isPhasesResolved = <T extends object>(
  instance: T,
): instance is PhasesResolved<T> => resolvedPhases in instance;

/** {@link withInstancePhases} for a list: one flag check, one rows query. */
export const withInstancesPhases = async <T extends InstanceWithData>({
  instances,
  db = defaultDb,
  fromRows,
}: {
  instances: T[];
  db?: DbClient;
  fromRows?: boolean;
}): Promise<PhasesResolved<T>[]> => {
  if (instances.length === 0) {
    return [];
  }

  if (!(fromRows ?? (await isPhasesFromRowsEnabled()))) {
    return instances.map(markResolved);
  }

  const phasesByInstance = await listPhasesByInstance({
    db,
    processInstanceIds: instances.map(({ id }) => id),
  });

  const withoutRows = instances
    .filter(({ id }) => !phasesByInstance.has(id))
    .map(({ id }) => id);
  if (withoutRows.length > 0) {
    logger.warn(NO_ROWS_WARNING, { processInstanceIds: withoutRows });
  }

  return instances.map((instance) => {
    const minted = phasesByInstance.get(instance.id);

    return replacePhases({
      instance,
      phases: minted
        ? mergePhasesWithInstanceData({
            phases: minted,
            blobPhases: getBlobPhases(instance),
          })
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

const getBlobPhases = (instance: InstanceWithData): PhaseInstanceData[] => [
  ...getInstancePhases(instance.instanceData),
];

const replacePhases = <T extends InstanceWithData>({
  instance,
  phases,
}: {
  instance: T;
  phases: PhaseInstanceData[] | null;
}): PhasesResolved<T> =>
  markResolved(
    phases
      ? {
          ...instance,
          instanceData: { ...asRecord(instance.instanceData), phases },
        }
      : instance,
  );

const markResolved = <T extends InstanceWithData>(
  instance: T,
): PhasesResolved<T> => ({ ...instance, [resolvedPhases]: true });

const asRecord = (value: unknown): object =>
  typeof value === 'object' && value !== null ? value : {};

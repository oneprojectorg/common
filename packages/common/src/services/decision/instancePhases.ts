import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { isServerFeatureEnabled } from '../../utils/featureFlags';
import {
  type DecisionPhase,
  listPhasesByInstance,
  phaseIdOf,
} from './phaseHelpers';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

// TODO: remove this flag and every fromRows param when instanceData.phases is dropped.
export const PHASES_FROM_ROWS_FLAG = 'process_phases_from_rows';

interface InstanceWithData {
  id: string;
  instanceData: unknown;
}

const resolvedPhases = Symbol('resolvedPhases');

// TODO: remove this brand when readers stop taking phases off instanceData.
export type PhasesResolved<T> = T & { readonly [resolvedPhases]: true };

const NO_ROWS_MESSAGE =
  'Decision has no phase rows; reading instanceData.phases';

export const isPhasesFromRowsEnabled = (): Promise<boolean> =>
  isServerFeatureEnabled({
    key: PHASES_FROM_ROWS_FLAG,
    distinctId: PHASES_FROM_ROWS_FLAG,
  });

export const getPhases = async ({
  instance,
  db = defaultDb,
  fromRows,
}: {
  instance: InstanceWithData;
  db?: DbClient;
  fromRows?: boolean;
}): Promise<PhaseInstanceData[]> =>
  getBlobPhases(await resolvePhases({ instance, db, fromRows }));

export const resolvePhases = async <T extends InstanceWithData>({
  instance,
  db = defaultDb,
  fromRows,
}: {
  instance: T;
  db?: DbClient;
  fromRows?: boolean;
}): Promise<PhasesResolved<T>> => {
  const [resolved] = await resolvePhasesForAll({
    instances: [instance],
    db,
    fromRows,
  });
  return resolved ?? markResolved(instance);
};

// TODO: remove when instanceData.phases is dropped.
export const markBlobPhasesResolved = <T extends InstanceWithData>({
  instance,
}: {
  instance: T;
}): PhasesResolved<T> => markResolved(instance);

export const isPhasesResolved = <T extends object>(
  instance: T,
): instance is PhasesResolved<T> => resolvedPhases in instance;

export const resolvePhasesForAll = async <T extends InstanceWithData>({
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

  // TODO: drop the blob fallback when instanceData.phases is dropped.
  const withoutRows = instances
    .filter(({ id }) => !phasesByInstance.has(id))
    .map(({ id }) => id);
  if (withoutRows.length > 0) {
    logger.debug(NO_ROWS_MESSAGE, { processInstanceIds: withoutRows });
  }

  return instances.map((instance) =>
    replacePhases({
      instance,
      phases: phasesByInstance.get(instance.id)?.map(toInstanceDataPhase),
    }),
  );
};

export const resolveProfilePhases = async <
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
    processInstance: await resolvePhases({
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
  phases?: PhaseInstanceData[];
}): PhasesResolved<T> =>
  markResolved(
    phases
      ? {
          ...instance,
          instanceData: { ...asRecord(instance.instanceData), phases },
        }
      : instance,
  );

const toInstanceDataPhase = (phase: DecisionPhase): PhaseInstanceData => ({
  ...phase.data,
  phaseId: phaseIdOf(phase),
  name: phase.name,
});

const markResolved = <T extends InstanceWithData>(
  instance: T,
): PhasesResolved<T> => ({ ...instance, [resolvedPhases]: true });

const asRecord = (value: unknown): object =>
  typeof value === 'object' && value !== null ? value : {};

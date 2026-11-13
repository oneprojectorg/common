import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { listPhasesByInstance } from './phaseHelpers';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

interface InstanceWithData {
  id: string;
  instanceData: unknown;
}

// Stays after the migration: an instance whose phases are loaded, by the resolver now or a query relation later.
export type InstanceWithPhases<T> = T & {
  readonly phases: PhaseInstanceData[];
};

type ProfileWithInstancePhases<
  T extends { processInstance: InstanceWithData | null },
> = Omit<T, 'processInstance'> & {
  processInstance: InstanceWithPhases<NonNullable<T['processInstance']>> | null;
};

export const getPhases = async ({
  instance,
  db = defaultDb,
}: {
  instance: InstanceWithData;
  db?: DbClient;
}): Promise<PhaseInstanceData[]> =>
  (await resolvePhases({ instance, db })).phases;

export const resolvePhases = async <T extends InstanceWithData>({
  instance,
  db = defaultDb,
}: {
  instance: T;
  db?: DbClient;
}): Promise<InstanceWithPhases<T>> =>
  withPhases({
    instance,
    rowsById: await loadRows({ db, instances: [instance] }),
  });

// TODO: remove when instanceData.phases is dropped.
export const attachBlobPhases = <T extends InstanceWithData>({
  instance,
}: {
  instance: T;
}): InstanceWithPhases<T> => ({
  ...instance,
  phases: [...getInstancePhases(instance.instanceData)],
});

export const resolvePhasesForAll = async <T extends InstanceWithData>({
  instances,
  db = defaultDb,
}: {
  instances: T[];
  db?: DbClient;
}): Promise<InstanceWithPhases<T>[]> => {
  const rowsById = await loadRows({ db, instances });
  return instances.map((instance) => withPhases({ instance, rowsById }));
};

export const resolveProfilePhases = async <
  T extends { processInstance: InstanceWithData | null },
>({
  profile,
  db = defaultDb,
}: {
  profile: T;
  db?: DbClient;
}): Promise<ProfileWithInstancePhases<T>> => ({
  ...profile,
  processInstance: profile.processInstance
    ? await resolvePhases({ instance: profile.processInstance, db })
    : null,
});

export const resolveProfilePhasesForAll = async <
  T extends { processInstance: InstanceWithData | null },
>({
  profiles,
  db = defaultDb,
}: {
  profiles: T[];
  db?: DbClient;
}): Promise<ProfileWithInstancePhases<T>[]> => {
  const rowsById = await loadRows({
    db,
    instances: profiles.flatMap(({ processInstance }) =>
      processInstance ? [processInstance] : [],
    ),
  });

  return profiles.map((profile) => ({
    ...profile,
    processInstance: profile.processInstance
      ? withPhases({ instance: profile.processInstance, rowsById })
      : null,
  }));
};

const loadRows = async ({
  db,
  instances,
}: {
  db: DbClient;
  instances: InstanceWithData[];
}): Promise<Map<string, PhaseInstanceData[]>> => {
  const rowsById = await listPhasesByInstance({
    db,
    processInstanceIds: instances.map(({ id }) => id),
  });

  // TODO: drop the blob fallback when instanceData.phases is dropped.
  const withoutRows = instances
    .filter(({ id }) => !rowsById.has(id))
    .map(({ id }) => id);
  if (withoutRows.length > 0) {
    logger.debug('Decision has no phase rows; reading instanceData.phases', {
      processInstanceIds: withoutRows,
    });
  }

  return rowsById;
};

const withPhases = <T extends InstanceWithData>({
  instance,
  rowsById,
}: {
  instance: T;
  rowsById: Map<string, PhaseInstanceData[]>;
}): InstanceWithPhases<T> => {
  const rows = rowsById.get(instance.id);
  return rows ? { ...instance, phases: rows } : attachBlobPhases({ instance });
};

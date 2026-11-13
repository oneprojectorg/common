import { type DbClient, db as defaultDb } from '@op/db/client';

import {
  type ProcessPhaseWithProfile,
  listPhasesByInstance,
  toInstanceDataPhase,
} from './phaseHelpers';
import type { PhaseInstanceData } from './schemas/instanceData';

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

// For a writer that already holds the instance's rows.
export const attachPhaseRows = <T extends InstanceWithData>({
  instance,
  phases,
}: {
  instance: T;
  phases: ProcessPhaseWithProfile[];
}): InstanceWithPhases<T> => ({
  ...instance,
  phases: phases.map(toInstanceDataPhase),
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
  phases,
  db = defaultDb,
}: {
  profile: T;
  phases?: ProcessPhaseWithProfile[];
  db?: DbClient;
}): Promise<ProfileWithInstancePhases<T>> => {
  const instance = profile.processInstance;
  if (!instance) {
    return { ...profile, processInstance: null };
  }

  return {
    ...profile,
    processInstance: phases
      ? attachPhaseRows({ instance, phases })
      : await resolvePhases({ instance, db }),
  };
};

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

const loadRows = ({
  db,
  instances,
}: {
  db: DbClient;
  instances: InstanceWithData[];
}): Promise<Map<string, PhaseInstanceData[]>> =>
  listPhasesByInstance({
    db,
    processInstanceIds: instances.map(({ id }) => id),
  });

const withPhases = <T extends InstanceWithData>({
  instance,
  rowsById,
}: {
  instance: T;
  rowsById: Map<string, PhaseInstanceData[]>;
}): InstanceWithPhases<T> => ({
  ...instance,
  phases: rowsById.get(instance.id) ?? [],
});

import { type DbClient, db as defaultDb } from '@op/db/client';

import { CommonError } from '../../utils';
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
}): Promise<InstanceWithPhases<T>> => {
  const [resolved] = await resolvePhasesForAll({ instances: [instance], db });
  if (!resolved) {
    throw new CommonError(`Phases did not resolve for instance ${instance.id}`);
  }
  return resolved;
};

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
  if (instances.length === 0) {
    return [];
  }

  const phasesByInstance = await listPhasesByInstance({
    db,
    processInstanceIds: instances.map(({ id }) => id),
  });

  return instances.map((instance) =>
    attachPhaseRows({
      instance,
      phases: phasesByInstance.get(instance.id) ?? [],
    }),
  );
};

export const resolveProfilePhases = async <
  T extends { processInstance: InstanceWithData | null },
>({
  profile,
  phases,
}: {
  profile: T;
  phases?: ProcessPhaseWithProfile[];
}): Promise<ProfileWithInstancePhases<T>> => {
  const instance = profile.processInstance;
  if (!instance) {
    return { ...profile, processInstance: null };
  }

  return {
    ...profile,
    processInstance: phases
      ? attachPhaseRows({ instance, phases })
      : await resolvePhases({ instance }),
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
  const resolved = await resolvePhasesForAll({
    instances: profiles.flatMap(({ processInstance }) =>
      processInstance ? [processInstance] : [],
    ),
    db,
  });
  const byId = new Map(resolved.map((instance) => [instance.id, instance]));

  return profiles.map((profile) => {
    if (!profile.processInstance) {
      return { ...profile, processInstance: null };
    }
    const instance = byId.get(profile.processInstance.id);
    if (!instance) {
      throw new CommonError(
        `Phases did not resolve for instance ${profile.processInstance.id}`,
      );
    }
    return { ...profile, processInstance: instance };
  });
};

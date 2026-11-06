import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import {
  type ProcessPhaseWithProfile,
  listPhasesByInstance,
  phaseIdOf,
} from './phaseHelpers';
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

export type ProfileWithInstancePhases<
  T extends { processInstance: InstanceWithData | null },
> = Omit<T, 'processInstance'> & {
  processInstance: InstanceWithPhases<NonNullable<T['processInstance']>> | null;
};

const NO_ROWS_MESSAGE =
  'Decision has no phase rows; reading instanceData.phases';

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
  if (instances.length === 0) {
    return [];
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

  return instances.map((instance) => {
    const rows = phasesByInstance.get(instance.id);
    return rows
      ? { ...instance, phases: rows.map(toInstanceDataPhase) }
      : attachBlobPhases({ instance });
  });
};

export const resolveProfilePhases = async <
  T extends { processInstance: InstanceWithData | null },
>({
  profile,
}: {
  profile: T;
}): Promise<ProfileWithInstancePhases<T>> => ({
  ...profile,
  processInstance: profile.processInstance
    ? await resolvePhases({ instance: profile.processInstance })
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

const toInstanceDataPhase = (
  phase: ProcessPhaseWithProfile,
): PhaseInstanceData => ({
  ...phase.data,
  phaseId: phaseIdOf(phase),
  name: phase.name,
});

import { type DbClient, db as defaultDb } from '@op/db/client';
import { logger } from '@op/logging';

import { CommonError } from '../../utils';
import { isServerFeatureEnabled } from '../../utils/featureFlags';
import {
  type ProcessPhaseWithProfile,
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

// Stays after the migration: an instance whose phases are loaded, by the resolver now or a query relation later.
export type WithPhases<T> = T & { readonly phases: PhaseInstanceData[] };

export type WithProfilePhases<
  T extends { processInstance: InstanceWithData | null },
> = Omit<T, 'processInstance'> & {
  processInstance: WithPhases<NonNullable<T['processInstance']>> | null;
};

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
  (await resolvePhases({ instance, db, fromRows })).phases;

export const resolvePhases = async <T extends InstanceWithData>({
  instance,
  db = defaultDb,
  fromRows,
}: {
  instance: T;
  db?: DbClient;
  fromRows?: boolean;
}): Promise<WithPhases<T>> => {
  const [resolved] = await resolvePhasesForAll({
    instances: [instance],
    db,
    fromRows,
  });
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
}): WithPhases<T> => ({
  ...instance,
  phases: [...getInstancePhases(instance.instanceData)],
});

export const resolvePhasesForAll = async <T extends InstanceWithData>({
  instances,
  db = defaultDb,
  fromRows,
}: {
  instances: T[];
  db?: DbClient;
  fromRows?: boolean;
}): Promise<WithPhases<T>[]> => {
  if (instances.length === 0) {
    return [];
  }

  if (!(fromRows ?? (await isPhasesFromRowsEnabled()))) {
    return instances.map((instance) => attachBlobPhases({ instance }));
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
}): Promise<WithProfilePhases<T>> => ({
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
}): Promise<WithProfilePhases<T>[]> => {
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

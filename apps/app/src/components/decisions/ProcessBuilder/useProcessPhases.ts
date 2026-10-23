'use client';

import { trpc } from '@op/api/client';
import { useMemo } from 'react';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export interface ProcessPhase {
  phaseId: string;
  name: string;
}

interface NamedPhase {
  name?: string;
}

export function useProcessPhases(
  instanceId: string,
  decisionProfileId?: string,
): ProcessPhase[] {
  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  return useMemo(
    () =>
      resolveProcessPhases({
        storePhases,
        instancePhases: instance?.instanceData?.phases,
        templatePhases: instance?.process?.processSchema?.phases,
      }),
    [storePhases, instance],
  );
}

export function resolveProcessPhases({
  storePhases,
  instancePhases,
  templatePhases,
}: {
  storePhases?: Array<NamedPhase & { phaseId: string }>;
  instancePhases?: Array<NamedPhase & { phaseId: string }>;
  templatePhases?: Array<NamedPhase & { id: string }>;
}): ProcessPhase[] {
  if (storePhases?.length) {
    return storePhases.map((phase) => ({
      phaseId: phase.phaseId,
      name: phase.name ?? '',
    }));
  }
  // An empty list is an answer; only an instance without one is still on
  // its template.
  if (instancePhases) {
    return instancePhases.map((phase) => ({
      phaseId: phase.phaseId,
      name: phase.name ?? '',
    }));
  }
  return (templatePhases ?? []).map((phase) => ({
    phaseId: phase.id,
    name: phase.name ?? '',
  }));
}
